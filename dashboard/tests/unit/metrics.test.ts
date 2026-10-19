import { describe, expect, it } from "vitest";
import {
  arAging,
  buildDashboard,
  daysBetween,
  defaultRange,
  monthlySeries,
  monthsIn,
  pipelineByStage,
  summarize,
  topOutstanding,
} from "../../src/server/metrics";
import { deal, invoice } from "./helpers";

const range = { from: "2026-01-01", to: "2026-06-30" };
const asOf = "2026-06-30";

describe("date helpers", () => {
  it("counts days between ISO dates", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
    expect(daysBetween("2026-03-01", "2026-02-28")).toBe(-1);
  });

  it("builds a trailing 12-month default range", () => {
    expect(defaultRange("2026-10-19")).toEqual({ from: "2025-10-20", to: "2026-10-19" });
  });

  it("lists every month in a range, across year boundaries", () => {
    expect(monthsIn({ from: "2025-11-15", to: "2026-02-03" })).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthsIn({ from: "2026-05-01", to: "2026-05-31" })).toEqual(["2026-05"]);
  });
});

describe("summarize", () => {
  it("separates open pipeline from won/lost deals in range", () => {
    const s = summarize(
      [
        deal({ stage: "Qualification", amount: 100 }),
        deal({ stage: "Negotiation/Review", amount: 200 }),
        deal({ stage: "Closed Won", amount: 500, closingDate: "2026-03-01" }),
        deal({ stage: "Closed Won", amount: 999, closingDate: "2025-12-31" }), // out of range
        deal({ stage: "Closed Lost", amount: 50, closingDate: "2026-04-01" }),
        deal({ stage: "Closed Lost to Competition", amount: 50, closingDate: "2026-04-02" }),
      ],
      [],
      range,
      asOf,
    );
    expect(s.openPipelineValue).toBe(300);
    expect(s.openDealCount).toBe(2);
    expect(s.wonValue).toBe(500);
    expect(s.wonCount).toBe(1);
    expect(s.winRate).toBeCloseTo(1 / 3);
  });

  it("reports a null win rate when nothing closed", () => {
    expect(summarize([deal()], [], range, asOf).winRate).toBeNull();
  });

  it("totals invoicing, collections and receivables, ignoring drafts and voids", () => {
    const s = summarize(
      [],
      [
        invoice({ date: "2026-02-01", total: 1000, balance: 0, status: "paid" }),
        invoice({ date: "2026-05-01", dueDate: "2026-05-31", total: 400, balance: 400, status: "overdue" }),
        invoice({ date: "2026-06-15", dueDate: "2026-07-15", total: 300, balance: 100, status: "partially_paid" }),
        invoice({ date: "2025-11-01", dueDate: "2025-12-01", total: 250, balance: 250, status: "overdue" }), // old but unpaid
        invoice({ date: "2026-03-01", total: 5000, balance: 5000, status: "draft" }),
        invoice({ date: "2026-03-01", total: 7000, balance: 0, status: "void" }),
      ],
      range,
      asOf,
    );
    expect(s.invoicedValue).toBe(1700);
    expect(s.collectedValue).toBe(1200);
    expect(s.outstandingValue).toBe(750);
    expect(s.overdueValue).toBe(650);
  });
});

describe("pipelineByStage", () => {
  it("groups open deals in CRM stage order with custom stages last", () => {
    const result = pipelineByStage([
      deal({ stage: "Negotiation/Review", amount: 10 }),
      deal({ stage: "Custom Stage", amount: 5 }),
      deal({ stage: "Qualification", amount: 1 }),
      deal({ stage: "Qualification", amount: 2 }),
      deal({ stage: "Closed Won", amount: 1000 }),
    ]);
    expect(result).toEqual([
      { stage: "Qualification", count: 2, amount: 3 },
      { stage: "Negotiation/Review", count: 1, amount: 10 },
      { stage: "Custom Stage", count: 1, amount: 5 },
    ]);
  });
});

describe("monthlySeries", () => {
  it("puts won deals and invoices in their months, with empty months as zero", () => {
    const series = monthlySeries(
      [deal({ stage: "Closed Won", amount: 500, closingDate: "2026-02-10" })],
      [invoice({ date: "2026-02-20", total: 300, balance: 100, status: "partially_paid" })],
      { from: "2026-01-01", to: "2026-03-31" },
    );
    expect(series).toEqual([
      { month: "2026-01", wonValue: 0, invoicedValue: 0, collectedValue: 0 },
      { month: "2026-02", wonValue: 500, invoicedValue: 300, collectedValue: 200 },
      { month: "2026-03", wonValue: 0, invoicedValue: 0, collectedValue: 0 },
    ]);
  });
});

describe("arAging", () => {
  it("buckets unpaid balances by days past due, with exact boundaries", () => {
    const due = (daysLate: number) => {
      const d = new Date(`${asOf}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - daysLate);
      return d.toISOString().slice(0, 10);
    };
    const buckets = arAging(
      [
        invoice({ dueDate: due(-5), balance: 1 }), // not yet due
        invoice({ dueDate: due(0), balance: 2 }), // due today = current
        invoice({ dueDate: due(1), balance: 4 }),
        invoice({ dueDate: due(30), balance: 8 }),
        invoice({ dueDate: due(31), balance: 16 }),
        invoice({ dueDate: due(90), balance: 32 }),
        invoice({ dueDate: due(91), balance: 64 }),
        invoice({ dueDate: due(200), balance: 0, status: "paid" }), // ignored
      ],
      asOf,
    );
    expect(buckets.map((b) => b.amount)).toEqual([3, 12, 16, 32, 64]);
    expect(buckets.map((b) => b.count)).toEqual([2, 2, 1, 1, 1]);
  });
});

describe("topOutstanding", () => {
  it("ranks customers by unpaid balance", () => {
    const rows = topOutstanding(
      [
        invoice({ customerName: "A", balance: 100, dueDate: "2026-01-01" }),
        invoice({ customerName: "B", balance: 300, dueDate: "2026-12-01" }),
        invoice({ customerName: "A", balance: 50, dueDate: "2026-12-01" }),
      ],
      asOf,
    );
    expect(rows).toEqual([
      { customerName: "B", outstanding: 300, overdue: 0, invoiceCount: 1 },
      { customerName: "A", outstanding: 150, overdue: 100, invoiceCount: 2 },
    ]);
  });
});

describe("buildDashboard", () => {
  it("assembles every section", () => {
    const d = buildDashboard([deal()], [invoice()], { range, asOf, mode: "mock", now: new Date("2026-06-30T12:00:00Z") });
    expect(d.generatedAt).toBe("2026-06-30T12:00:00.000Z");
    expect(d.monthly).toHaveLength(6);
    expect(d.arAging).toHaveLength(5);
    expect(Object.keys(d)).toEqual(["mode", "generatedAt", "range", "summary", "pipeline", "monthly", "arAging", "topOutstanding"]);
  });
});
