import { describe, expect, it } from "vitest";
import { ZohoAuth } from "../../src/server/zoho/auth";
import { CrmClient, toDeal } from "../../src/server/zoho/crm";
import { ZohoApiError } from "../../src/server/zoho/http";
import { fakeFetch } from "./helpers";

const BASE = "https://www.zohoapis.com";
const token = { body: { access_token: "tok", expires_in: 3600 } };

function setup(responses: Array<{ status?: number; body?: unknown }>) {
  const f = fakeFetch([token, ...responses]);
  const auth = new ZohoAuth({ clientId: "c", clientSecret: "s", refreshToken: "r", dc: "com", fetchImpl: f.fn });
  return { crm: new CrmClient(auth, BASE, f.fn), calls: f.calls };
}

const rawDeal = (id: string) => ({
  id,
  Deal_Name: `Deal ${id}`,
  Stage: "Qualification",
  Amount: 1200,
  Closing_Date: "2026-05-01",
  Owner: { name: "Alex", id: "o1" },
  Account_Name: { name: "Acme", id: "a1" },
  Created_Time: "2026-01-02T10:00:00-07:00",
});

describe("CrmClient", () => {
  it("follows page numbers, then page_token, until more_records is false", async () => {
    const { crm, calls } = setup([
      { body: { data: [rawDeal("1")], info: { more_records: true } } },
      { body: { data: [rawDeal("2")], info: { more_records: true, next_page_token: "abc" } } },
      { body: { data: [rawDeal("3")], info: { more_records: false } } },
    ]);
    const deals = await crm.getDeals();
    expect(deals.map((d) => d.id)).toEqual(["1", "2", "3"]);

    const urls = calls.slice(1).map((c) => new URL(c.url));
    expect(urls[0].pathname).toBe("/crm/v7/Deals");
    expect(urls[0].searchParams.get("page")).toBe("1");
    expect(urls[0].searchParams.get("fields")).toContain("Deal_Name");
    expect(urls[1].searchParams.get("page")).toBe("2");
    expect(urls[2].searchParams.get("page_token")).toBe("abc");
    expect(urls[2].searchParams.has("page")).toBe(false);
    expect(calls[1].init?.headers).toEqual({ Authorization: "Zoho-oauthtoken tok" });
  });

  it("treats 204 No Content as an empty module", async () => {
    const { crm } = setup([{ status: 204 }]);
    expect(await crm.getDeals()).toEqual([]);
  });

  it("refreshes the token and retries once on 401", async () => {
    const { crm, calls } = setup([
      { status: 401, body: { code: "INVALID_TOKEN" } },
      { body: { access_token: "tok2", expires_in: 3600 } },
      { body: { data: [rawDeal("1")], info: { more_records: false } } },
    ]);
    expect(await crm.getDeals()).toHaveLength(1);
    expect(calls[3].init?.headers).toEqual({ Authorization: "Zoho-oauthtoken tok2" });
  });

  it("throws ZohoApiError on other failures", async () => {
    const { crm } = setup([{ status: 400, body: { code: "INVALID_DATA", message: "bad field" } }]);
    await expect(crm.getDeals()).rejects.toThrow(ZohoApiError);
  });
});

describe("toDeal", () => {
  it("flattens lookups and fills defaults for missing fields", () => {
    expect(toDeal(rawDeal("9"))).toMatchObject({ owner: "Alex", accountName: "Acme", amount: 1200 });
    expect(toDeal({ id: 5 })).toEqual({
      id: "5",
      name: "",
      stage: "Unknown",
      amount: 0,
      closingDate: null,
      owner: "Unassigned",
      accountName: null,
      createdTime: "",
    });
  });
});
