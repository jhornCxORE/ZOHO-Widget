import { describe, expect, it } from "vitest";
import { generateMockData } from "../../src/server/data/mock";
import { CachedProvider, type DataProvider } from "../../src/server/data/provider";
import { deal } from "./helpers";

describe("generateMockData", () => {
  const asOf = "2026-10-19";

  it("is deterministic for the same seed and date", () => {
    expect(generateMockData(asOf, 7)).toEqual(generateMockData(asOf, 7));
    expect(generateMockData(asOf, 7)).not.toEqual(generateMockData(asOf, 8));
  });

  it("produces consistent records", () => {
    const { deals, invoices } = generateMockData(asOf);
    expect(deals.length).toBeGreaterThan(100);
    expect(invoices.length).toBeGreaterThan(50);
    for (const i of invoices) {
      expect(i.date <= asOf).toBe(true);
      expect(i.balance).toBeGreaterThanOrEqual(0);
      expect(i.balance).toBeLessThanOrEqual(i.total);
      if (i.status === "paid") expect(i.balance).toBe(0);
    }
    expect(new Set(deals.map((d) => d.stage))).toContain("Closed Won");
  });
});

describe("CachedProvider", () => {
  function counting(fail = false) {
    let calls = 0;
    const inner: DataProvider = {
      mode: "live",
      getDeals: async () => {
        calls++;
        if (fail) throw new Error("boom");
        return [deal()];
      },
      getInvoices: async () => [],
    };
    return { inner, calls: () => calls };
  }

  it("serves cached results within the TTL and reloads after", async () => {
    let now = 0;
    const c = counting();
    const p = new CachedProvider(c.inner, 1000, () => now);
    await p.getDeals();
    await p.getDeals();
    expect(c.calls()).toBe(1);
    now = 1001;
    await p.getDeals();
    expect(c.calls()).toBe(2);
  });

  it("does not cache failures", async () => {
    const c = counting(true);
    const p = new CachedProvider(c.inner, 60_000);
    await expect(p.getDeals()).rejects.toThrow("boom");
    await expect(p.getDeals()).rejects.toThrow("boom");
    expect(c.calls()).toBe(2);
  });

  it("clearCache forces a reload", async () => {
    const c = counting();
    const p = new CachedProvider(c.inner, 60_000);
    await p.getDeals();
    p.clearCache();
    await p.getDeals();
    expect(c.calls()).toBe(2);
  });
});
