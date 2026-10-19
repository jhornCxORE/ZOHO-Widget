import type { Deal, Invoice } from "../../src/shared/types";

export interface FakeCall {
  url: string;
  init?: RequestInit;
}

/** A fetch stand-in that replays canned responses in order and records each call. */
export function fakeFetch(responses: Array<{ status?: number; body?: unknown }>) {
  const calls: FakeCall[] = [];
  const queue = [...responses];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const next = queue.shift();
    if (!next) throw new Error(`Unexpected fetch: ${String(input)}`);
    const status = next.status ?? 200;
    const text = next.body === undefined ? "" : JSON.stringify(next.body);
    return new Response(status === 204 ? null : text, { status });
  }) as typeof fetch;
  return { fn, calls };
}

let n = 0;
export const deal = (over: Partial<Deal> = {}): Deal => ({
  id: `d${++n}`,
  name: "Deal",
  stage: "Qualification",
  amount: 1000,
  closingDate: "2026-06-15",
  owner: "Owner",
  accountName: "Acme",
  createdTime: "2026-01-01T00:00:00Z",
  ...over,
});

export const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: `i${++n}`,
  number: `INV-${n}`,
  customerName: "Acme",
  date: "2026-06-01",
  dueDate: "2026-07-01",
  status: "sent",
  total: 1000,
  balance: 1000,
  ...over,
});
