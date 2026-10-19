import { describe, expect, it } from "vitest";
import { ZohoAuth } from "../../src/server/zoho/auth";
import { BooksClient, toInvoice } from "../../src/server/zoho/books";
import { ZohoApiError } from "../../src/server/zoho/http";
import { fakeFetch } from "./helpers";

const token = { body: { access_token: "tok", expires_in: 3600 } };

function setup(responses: Array<{ status?: number; body?: unknown }>) {
  const f = fakeFetch([token, ...responses]);
  const auth = new ZohoAuth({ clientId: "c", clientSecret: "s", refreshToken: "r", dc: "com", fetchImpl: f.fn });
  return { books: new BooksClient(auth, "https://www.zohoapis.com", "org123", f.fn), calls: f.calls };
}

const rawInvoice = (id: string, status = "sent") => ({
  invoice_id: id,
  invoice_number: `INV-${id}`,
  customer_name: "Acme",
  date: "2026-05-01",
  due_date: "2026-05-31",
  status,
  total: 500,
  balance: 500,
});

describe("BooksClient", () => {
  it("sends organization_id and follows has_more_page", async () => {
    const { books, calls } = setup([
      { body: { code: 0, invoices: [rawInvoice("1")], page_context: { has_more_page: true } } },
      { body: { code: 0, invoices: [rawInvoice("2")], page_context: { has_more_page: false } } },
    ]);
    const invoices = await books.getInvoices();
    expect(invoices.map((i) => i.id)).toEqual(["1", "2"]);
    const urls = calls.slice(1).map((c) => new URL(c.url));
    expect(urls[0].pathname).toBe("/books/v3/invoices");
    expect(urls.map((u) => u.searchParams.get("organization_id"))).toEqual(["org123", "org123"]);
    expect(urls.map((u) => u.searchParams.get("page"))).toEqual(["1", "2"]);
  });

  it("throws when Books returns a non-zero code", async () => {
    const { books } = setup([{ body: { code: 57, message: "You are not authorized" } }]);
    await expect(books.getInvoices()).rejects.toThrow(/57/);
  });

  it("throws on HTTP errors", async () => {
    const { books } = setup([{ status: 500, body: { code: 1, message: "boom" } }]);
    await expect(books.getInvoices()).rejects.toThrow(ZohoApiError);
  });
});

describe("toInvoice", () => {
  it("normalizes status casing and falls back for unknown statuses", () => {
    expect(toInvoice(rawInvoice("1", "Overdue")).status).toBe("overdue");
    expect(toInvoice(rawInvoice("1", "something_new")).status).toBe("sent");
  });
});
