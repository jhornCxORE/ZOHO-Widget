import type { DataMode, Deal, Invoice } from "../../shared/types.js";
import type { BooksClient } from "../zoho/books.js";
import type { CrmClient } from "../zoho/crm.js";
import { generateMockData } from "./mock.js";

/** Where the dashboard gets its raw records. Swap implementations to change the source. */
export interface DataProvider {
  readonly mode: DataMode;
  getDeals(): Promise<Deal[]>;
  getInvoices(): Promise<Invoice[]>;
  /** Forget any cached results. */
  clearCache?(): void;
}

export class MockProvider implements DataProvider {
  readonly mode = "mock" as const;
  private readonly data;

  constructor(asOf: string, seed?: number) {
    this.data = generateMockData(asOf, seed);
  }

  async getDeals() {
    return this.data.deals;
  }

  async getInvoices() {
    return this.data.invoices;
  }
}

export class LiveProvider implements DataProvider {
  readonly mode = "live" as const;

  constructor(
    private readonly crm: CrmClient,
    private readonly books: BooksClient,
  ) {}

  getDeals() {
    return this.crm.getDeals();
  }

  getInvoices() {
    return this.books.getInvoices();
  }
}

/**
 * Caches another provider's results for `ttlMs`. Zoho APIs have daily call
 * limits, so live mode should always sit behind this.
 */
export class CachedProvider implements DataProvider {
  private cache = new Map<string, { at: number; value: Promise<unknown> }>();

  constructor(
    private readonly inner: DataProvider,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get mode() {
    return this.inner.mode;
  }

  getDeals() {
    return this.cached("deals", () => this.inner.getDeals());
  }

  getInvoices() {
    return this.cached("invoices", () => this.inner.getInvoices());
  }

  clearCache() {
    this.cache.clear();
  }

  private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.value as Promise<T>;
    const value = load();
    this.cache.set(key, { at: this.now(), value });
    // Don't keep failures around; the next request should retry.
    value.catch(() => {
      if (this.cache.get(key)?.value === value) this.cache.delete(key);
    });
    return value;
  }
}
