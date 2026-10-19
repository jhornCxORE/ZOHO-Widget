// Deterministic sample data so the dashboard and tests run without Zoho credentials.
// The same seed and `asOf` date always produce the same deals and invoices.

import type { Deal, Invoice, InvoiceStatus } from "../../shared/types.js";
import { DEFAULT_STAGE_ORDER, toIsoDate } from "../metrics.js";

const CUSTOMERS = [
  "Acme Logistics", "Blue Oak Dental", "Cedar Ridge Builders", "Delta Fresh Foods", "Evergreen Realty",
  "Foothill Auto Group", "Granite Bay Fitness", "Harbor Point Marine", "Iron Gate Security", "Juniper Health",
  "Keystone Accounting", "Lakeside Vineyards", "Maple Street Bakery", "Northstar Engineering", "Oakmont Insurance",
  "Pioneer Solar", "Quarry Lane Outfitters", "Riverbend Clinic", "Summit Legal Partners", "Timberline Coffee",
  "Union Valley Credit", "Vista Print Co.", "Westside Pet Hospital", "Yellowstone Tours", "Zenith Software",
];

const OWNERS = ["Alex Rivera", "Jordan Lee", "Sam Patel", "Taylor Kim", "Morgan Diaz"];

/** mulberry32: tiny seeded PRNG. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
};

export interface MockData {
  deals: Deal[];
  invoices: Invoice[];
}

export function generateMockData(asOf: string, seed = 42): MockData {
  const rand = rng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const amount = () => Math.round((2_000 + rand() ** 2.2 * 118_000) / 100) * 100;

  const deals: Deal[] = [];
  for (let n = 1; n <= 220; n++) {
    const closingDate = addDays(asOf, between(-450, 120));
    const createdTime = `${addDays(closingDate, -between(20, 120))}T15:00:00Z`;
    let stage: string;
    if (closingDate < asOf) {
      const r = rand();
      stage = r < 0.5 ? "Closed Won" : r < 0.88 ? "Closed Lost" : pick(DEFAULT_STAGE_ORDER);
    } else {
      // Open deals skew toward early stages.
      stage = DEFAULT_STAGE_ORDER[Math.min(Math.floor(rand() ** 1.6 * 6), 5)];
    }
    const customer = pick(CUSTOMERS);
    deals.push({
      id: `mock-deal-${n}`,
      name: `${customer} – ${pick(["Renewal", "Expansion", "New Contract", "Pilot", "Services"])}`,
      stage,
      amount: amount(),
      closingDate,
      owner: pick(OWNERS),
      accountName: customer,
      createdTime,
    });
  }

  const invoices: Invoice[] = [];
  let invNo = 1000;
  const addInvoice = (customerName: string, date: string, total: number, forceStatus?: InvoiceStatus) => {
    if (date > asOf) return;
    const dueDate = addDays(date, 30);
    const overdueDays = Math.max(0, Math.round((Date.parse(asOf) - Date.parse(dueDate)) / 86_400_000));
    const payChance = dueDate >= asOf ? 0.3 : overdueDays > 60 ? 0.92 : 0.7;
    let status: InvoiceStatus;
    let balance: number;
    const r = rand();
    if (forceStatus) {
      status = forceStatus;
      balance = forceStatus === "void" ? 0 : total;
    } else if (r < payChance) {
      status = "paid";
      balance = 0;
    } else if (r < payChance + 0.1) {
      status = "partially_paid";
      balance = Math.round(total * 0.5 * 100) / 100;
    } else {
      status = dueDate < asOf ? "overdue" : "sent";
      balance = total;
    }
    invNo += 1;
    invoices.push({
      id: `mock-inv-${invNo}`,
      number: `INV-${invNo}`,
      customerName,
      date,
      dueDate,
      status,
      total,
      balance,
    });
  };

  // Won deals are billed in 1–3 installments starting at close.
  for (const d of deals) {
    if (d.stage !== "Closed Won" || !d.closingDate) continue;
    const parts = between(1, 3);
    for (let p = 0; p < parts; p++) {
      addInvoice(d.accountName!, addDays(d.closingDate, p * 30 + between(0, 7)), Math.round((d.amount / parts) * 100) / 100);
    }
  }
  // A few drafts and voids, which the metrics must ignore.
  for (let n = 0; n < 6; n++) {
    addInvoice(pick(CUSTOMERS), addDays(asOf, -between(0, 200)), amount(), n % 2 ? "draft" : "void");
  }

  invoices.sort((a, b) => a.date.localeCompare(b.date));
  return { deals, invoices };
}
