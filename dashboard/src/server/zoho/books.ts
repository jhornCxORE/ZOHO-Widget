// Zoho Books REST API (v3) client.
// Docs: https://www.zoho.com/books/api/v3/invoices/

import type { Invoice, InvoiceStatus } from "../../shared/types.js";
import type { ZohoAuth } from "./auth.js";
import { ZohoApiError, zohoGetOk } from "./http.js";

const PER_PAGE = 200;
/** Safety stop: 200 pages × 200 invoices = 40k invoices. */
const MAX_PAGES = 200;

interface BooksListResponse {
  code: number;
  message?: string;
  page_context?: { has_more_page?: boolean };
  [key: string]: unknown;
}

const KNOWN_STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "viewed",
  "unpaid",
  "partially_paid",
  "overdue",
  "paid",
  "void",
];

export class BooksClient {
  constructor(
    private readonly auth: ZohoAuth,
    private readonly baseUrl: string,
    private readonly orgId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Fetches every item of a Books list endpoint (e.g. "invoices"), following pagination. */
  async getAll(resource: string, query: Record<string, string> = {}): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = new URL(`${this.baseUrl}/books/v3/${resource}`);
      url.searchParams.set("organization_id", this.orgId);
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", String(PER_PAGE));
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

      const body = (await zohoGetOk(this.auth, url.toString(), this.fetchImpl)) as BooksListResponse;
      // Books signals errors with a non-zero `code`, sometimes alongside HTTP 200.
      if (body.code !== 0) {
        throw new ZohoApiError(`Zoho Books error ${body.code}: ${body.message ?? "unknown"}`, 200, body);
      }
      items.push(...((body[resource] as Record<string, unknown>[] | undefined) ?? []));
      if (!body.page_context?.has_more_page) break;
    }
    return items;
  }

  async getInvoices(): Promise<Invoice[]> {
    const rows = await this.getAll("invoices");
    return rows.map(toInvoice);
  }
}

export function toInvoice(r: Record<string, unknown>): Invoice {
  const status = String(r.status ?? "").toLowerCase() as InvoiceStatus;
  return {
    id: String(r.invoice_id),
    number: String(r.invoice_number ?? ""),
    customerName: String(r.customer_name ?? "Unknown customer"),
    date: String(r.date ?? ""),
    dueDate: String(r.due_date ?? r.date ?? ""),
    status: KNOWN_STATUSES.includes(status) ? status : "sent",
    total: Number(r.total ?? 0),
    balance: Number(r.balance ?? 0),
  };
}
