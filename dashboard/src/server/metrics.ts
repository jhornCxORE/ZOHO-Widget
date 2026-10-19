// Pure functions that turn normalized deals and invoices into dashboard data.
// No I/O here, so everything in this file is unit-tested directly.

import type {
  AgingBucket,
  CustomerBalance,
  DashboardData,
  DataMode,
  DateRange,
  Deal,
  Invoice,
  MonthPoint,
  StageBucket,
  Summary,
} from "../shared/types.js";

/** Zoho CRM's default stage order; custom stages are appended alphabetically. */
export const DEFAULT_STAGE_ORDER = [
  "Qualification",
  "Needs Analysis",
  "Value Proposition",
  "Identify Decision Makers",
  "Proposal/Price Quote",
  "Negotiation/Review",
];

export const isWon = (d: Deal) => d.stage === "Closed Won";
export const isLost = (d: Deal) => d.stage.startsWith("Closed Lost");
export const isOpen = (d: Deal) => !isWon(d) && !isLost(d);

/** Invoices that represent real billing (drafts and voids are excluded). */
export const isBilled = (inv: Invoice) => inv.status !== "draft" && inv.status !== "void";

const inRange = (date: string | null, range: DateRange) =>
  date !== null && date >= range.from && date <= range.to;

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Default dashboard range: the trailing 12 months ending on `asOf`. */
export function defaultRange(asOf: string): DateRange {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  d.setUTCDate(d.getUTCDate() + 1);
  return { from: toIsoDate(d), to: asOf };
}

export function summarize(deals: Deal[], invoices: Invoice[], range: DateRange, asOf: string): Summary {
  const open = deals.filter(isOpen);
  const won = deals.filter((d) => isWon(d) && inRange(d.closingDate, range));
  const lost = deals.filter((d) => isLost(d) && inRange(d.closingDate, range));
  const billedInRange = invoices.filter((i) => isBilled(i) && inRange(i.date, range));
  const unpaid = invoices.filter((i) => isBilled(i) && i.balance > 0);

  return {
    openPipelineValue: sum(open.map((d) => d.amount)),
    openDealCount: open.length,
    wonValue: sum(won.map((d) => d.amount)),
    wonCount: won.length,
    winRate: won.length + lost.length === 0 ? null : won.length / (won.length + lost.length),
    invoicedValue: sum(billedInRange.map((i) => i.total)),
    collectedValue: sum(billedInRange.map((i) => i.total - i.balance)),
    outstandingValue: sum(unpaid.map((i) => i.balance)),
    overdueValue: sum(unpaid.filter((i) => i.dueDate < asOf).map((i) => i.balance)),
  };
}

/** Open deals grouped by stage, in pipeline order. */
export function pipelineByStage(deals: Deal[]): StageBucket[] {
  const buckets = new Map<string, StageBucket>();
  for (const d of deals.filter(isOpen)) {
    const b = buckets.get(d.stage) ?? { stage: d.stage, count: 0, amount: 0 };
    b.count += 1;
    b.amount = round2(b.amount + d.amount);
    buckets.set(d.stage, b);
  }
  const rank = (stage: string) => {
    const i = DEFAULT_STAGE_ORDER.indexOf(stage);
    return i === -1 ? DEFAULT_STAGE_ORDER.length : i;
  };
  return [...buckets.values()].sort((a, b) => rank(a.stage) - rank(b.stage) || a.stage.localeCompare(b.stage));
}

/** Every YYYY-MM month touched by the range, oldest first. */
export function monthsIn(range: DateRange): string[] {
  const months: string[] = [];
  let [y, m] = range.from.slice(0, 7).split("-").map(Number);
  const end = range.to.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    months.push(key);
    if (key >= end) return months;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
}

export function monthlySeries(deals: Deal[], invoices: Invoice[], range: DateRange): MonthPoint[] {
  const points = new Map<string, MonthPoint>(
    monthsIn(range).map((month) => [month, { month, wonValue: 0, invoicedValue: 0, collectedValue: 0 }]),
  );
  for (const d of deals) {
    if (!isWon(d) || !inRange(d.closingDate, range)) continue;
    const p = points.get(d.closingDate!.slice(0, 7))!;
    p.wonValue = round2(p.wonValue + d.amount);
  }
  for (const i of invoices) {
    if (!isBilled(i) || !inRange(i.date, range)) continue;
    const p = points.get(i.date.slice(0, 7))!;
    p.invoicedValue = round2(p.invoicedValue + i.total);
    p.collectedValue = round2(p.collectedValue + i.total - i.balance);
  }
  return [...points.values()];
}

export const AGING_LABELS = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"] as const;

/** Unpaid balances bucketed by days past due as of `asOf`. */
export function arAging(invoices: Invoice[], asOf: string): AgingBucket[] {
  const buckets: AgingBucket[] = AGING_LABELS.map((label) => ({ label, amount: 0, count: 0 }));
  for (const i of invoices) {
    if (!isBilled(i) || i.balance <= 0) continue;
    const late = daysBetween(i.dueDate, asOf);
    const idx = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
    buckets[idx].amount = round2(buckets[idx].amount + i.balance);
    buckets[idx].count += 1;
  }
  return buckets;
}

export function topOutstanding(invoices: Invoice[], asOf: string, limit = 10): CustomerBalance[] {
  const byCustomer = new Map<string, CustomerBalance>();
  for (const i of invoices) {
    if (!isBilled(i) || i.balance <= 0) continue;
    const c = byCustomer.get(i.customerName) ?? {
      customerName: i.customerName,
      outstanding: 0,
      overdue: 0,
      invoiceCount: 0,
    };
    c.outstanding = round2(c.outstanding + i.balance);
    if (i.dueDate < asOf) c.overdue = round2(c.overdue + i.balance);
    c.invoiceCount += 1;
    byCustomer.set(i.customerName, c);
  }
  return [...byCustomer.values()].sort((a, b) => b.outstanding - a.outstanding).slice(0, limit);
}

export function buildDashboard(
  deals: Deal[],
  invoices: Invoice[],
  opts: { range: DateRange; asOf: string; mode: DataMode; now?: Date },
): DashboardData {
  const { range, asOf, mode } = opts;
  return {
    mode,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    range,
    summary: summarize(deals, invoices, range, asOf),
    pipeline: pipelineByStage(deals),
    monthly: monthlySeries(deals, invoices, range),
    arAging: arAging(invoices, asOf),
    topOutstanding: topOutstanding(invoices, asOf),
  };
}
