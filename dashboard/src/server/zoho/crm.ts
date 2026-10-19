// Zoho CRM REST API (v7) client.
// Docs: https://www.zoho.com/crm/developer/docs/api/v7/get-records.html

import type { Deal } from "../../shared/types.js";
import type { ZohoAuth } from "./auth.js";
import { zohoGetOk } from "./http.js";

const PER_PAGE = 200;
/** Safety stop: 200 pages × 200 records = 40k records. */
const MAX_PAGES = 200;

interface CrmListResponse {
  data?: Record<string, unknown>[];
  info?: { more_records?: boolean; next_page_token?: string | null };
}

export const DEAL_FIELDS = ["Deal_Name", "Stage", "Amount", "Closing_Date", "Owner", "Account_Name", "Created_Time"];

export class CrmClient {
  constructor(
    private readonly auth: ZohoAuth,
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Fetches every record of a module, following pagination. */
  async getAllRecords(module: string, fields: string[]): Promise<Record<string, unknown>[]> {
    const records: Record<string, unknown>[] = [];
    let page = 1;
    let pageToken: string | null = null;

    for (let i = 0; i < MAX_PAGES; i++) {
      const url = new URL(`${this.baseUrl}/crm/v7/${module}`);
      url.searchParams.set("fields", fields.join(","));
      url.searchParams.set("per_page", String(PER_PAGE));
      // Page numbers only reach the first 2,000 records; after that CRM requires page_token.
      if (pageToken) url.searchParams.set("page_token", pageToken);
      else url.searchParams.set("page", String(page));

      const body = (await zohoGetOk(this.auth, url.toString(), this.fetchImpl)) as CrmListResponse | null;
      if (!body?.data) break; // 204 No Content: module is empty
      records.push(...body.data);
      if (!body.info?.more_records) break;
      pageToken = body.info.next_page_token ?? null;
      page += 1;
    }
    return records;
  }

  async getDeals(): Promise<Deal[]> {
    const rows = await this.getAllRecords("Deals", DEAL_FIELDS);
    return rows.map(toDeal);
  }
}

const lookupName = (v: unknown): string | null =>
  v && typeof v === "object" && "name" in v ? String((v as { name: unknown }).name) : null;

export function toDeal(r: Record<string, unknown>): Deal {
  return {
    id: String(r.id),
    name: String(r.Deal_Name ?? ""),
    stage: String(r.Stage ?? "Unknown"),
    amount: Number(r.Amount ?? 0),
    closingDate: (r.Closing_Date as string | null) ?? null,
    owner: lookupName(r.Owner) ?? "Unassigned",
    accountName: lookupName(r.Account_Name),
    createdTime: String(r.Created_Time ?? ""),
  };
}
