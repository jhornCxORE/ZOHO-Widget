import type { DashboardData, DateRange, ZohoProbeRequest, ZohoProbeResponse } from "../../src/shared/types";

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new RequestError(body?.error ?? `HTTP ${res.status}`, res.status, body?.detail);
  return body as T;
}

export const getHealth = () => request<{ ok: boolean; mode: "mock" | "live"; apiTester: boolean }>("/api/health");

export function getDashboard(range: DateRange, refresh = false) {
  const q = new URLSearchParams({ from: range.from, to: range.to });
  if (refresh) q.set("refresh", "1");
  return request<DashboardData>(`/api/dashboard?${q}`);
}

export const probeZoho = (req: ZohoProbeRequest) =>
  request<ZohoProbeResponse>("/api/zoho", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
