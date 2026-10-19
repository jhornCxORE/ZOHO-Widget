import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server/app";
import { loadConfig } from "../../src/server/config";
import { MockProvider } from "../../src/server/data/provider";
import { ZohoAuth } from "../../src/server/zoho/auth";
import { createProbe } from "../../src/server/zoho/probe";
import { fakeFetch } from "./helpers";

const today = () => "2026-10-19";
const mockApp = () => createApp({ provider: new MockProvider(today()), probe: null, today });

describe("API (mock mode)", () => {
  it("GET /api/health", async () => {
    const res = await request(mockApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, mode: "mock", apiTester: false });
  });

  it("GET /api/dashboard defaults to the trailing 12 months", async () => {
    const res = await request(mockApp()).get("/api/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.range).toEqual({ from: "2025-10-20", to: "2026-10-19" });
    expect(res.body.monthly).toHaveLength(13);
    expect(res.body.summary.openDealCount).toBeGreaterThan(0);
  });

  it("GET /api/dashboard honors from/to", async () => {
    const res = await request(mockApp()).get("/api/dashboard?from=2026-07-01&to=2026-09-30");
    expect(res.status).toBe(200);
    expect(res.body.monthly.map((m: { month: string }) => m.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it.each([
    ["from=2026-01-01", "both"],
    ["from=2026-13-01&to=2026-12-01", "valid date"],
    ["from=2026-06-01&to=2026-01-01", "on or before"],
    ["from=2010-01-01&to=2026-01-01", "5 years"],
    ["from=01/01/2026&to=2026-02-01", "YYYY-MM-DD"],
  ])("rejects bad range %s", async (qs, msg) => {
    const res = await request(mockApp()).get(`/api/dashboard?${qs}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain(msg);
  });

  it("explains that the API tester needs live mode", async () => {
    const res = await request(mockApp()).post("/api/zoho").send({ service: "crm", path: "/crm/v7/Deals" });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("DATA_MODE=live");
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const res = await request(mockApp()).get("/api/nope");
    expect(res.status).toBe(404);
  });
});

describe("API tester passthrough", () => {
  function liveApp(responses: Array<{ status?: number; body?: unknown }>) {
    const f = fakeFetch([{ body: { access_token: "tok", expires_in: 3600 } }, ...responses]);
    const auth = new ZohoAuth({ clientId: "c", clientSecret: "s", refreshToken: "r", dc: "com", fetchImpl: f.fn });
    const probe = createProbe({ auth, baseUrl: "https://www.zohoapis.com", booksOrgId: "org1", fetchImpl: f.fn });
    return { app: createApp({ provider: new MockProvider(today()), probe, today }), calls: f.calls };
  }

  it("forwards GETs and adds the Books organization_id", async () => {
    const { app, calls } = liveApp([{ body: { code: 0, invoices: [] } }]);
    const res = await request(app)
      .post("/api/zoho")
      .send({ service: "books", path: "/books/v3/invoices", query: { per_page: "5" } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(200);
    expect(res.body.body).toEqual({ code: 0, invoices: [] });
    const url = new URL(calls[1].url);
    expect(url.searchParams.get("organization_id")).toBe("org1");
    expect(url.searchParams.get("per_page")).toBe("5");
  });

  it("passes Zoho error statuses through instead of failing", async () => {
    const { app } = liveApp([{ status: 400, body: { code: "INVALID_MODULE" } }]);
    const res = await request(app).post("/api/zoho").send({ service: "crm", path: "/crm/v7/Nope" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(400);
  });

  it.each([
    [{ service: "crm", path: "/books/v3/invoices" }],
    [{ service: "crm", path: "/crm/v7/../../oauth" }],
    [{ service: "crm", path: "https://evil.example/crm/" }],
    [{ service: "desk", path: "/desk/v1/tickets" }],
  ])("rejects unsafe request %j", async (body) => {
    const { app } = liveApp([]);
    const res = await request(app).post("/api/zoho").send(body);
    expect(res.status).toBe(400);
  });
});

describe("loadConfig", () => {
  it("defaults to mock mode", () => {
    expect(loadConfig({}).mode).toBe("mock");
  });

  it("requires credentials in live mode", () => {
    expect(() => loadConfig({ DATA_MODE: "live" })).toThrow(/ZOHO_CLIENT_ID/);
  });

  it("disables the API tester in production unless explicitly enabled", () => {
    expect(loadConfig({ NODE_ENV: "production" }).enableApiTester).toBe(false);
    expect(loadConfig({ NODE_ENV: "production", ENABLE_API_TESTER: "true" }).enableApiTester).toBe(true);
    expect(loadConfig({}).enableApiTester).toBe(true);
  });
});
