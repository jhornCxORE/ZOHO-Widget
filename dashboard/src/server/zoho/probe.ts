// Backs the API tester page: performs a single read-only GET against Zoho with
// the server's credentials and returns the raw response.

import type { ZohoProbeRequest, ZohoProbeResponse } from "../../shared/types.js";
import type { ZohoAuth } from "./auth.js";
import { zohoGet } from "./http.js";

export class ProbeValidationError extends Error {}

export type Probe = (req: ZohoProbeRequest) => Promise<ZohoProbeResponse>;

const PATH_PATTERN = /^\/[A-Za-z0-9_\-/.]*$/;

export function createProbe(opts: {
  auth: ZohoAuth;
  baseUrl: string;
  booksOrgId: string;
  fetchImpl?: typeof fetch;
}): Probe {
  return async ({ service, path, query = {} }) => {
    const prefix = service === "crm" ? "/crm/" : service === "books" ? "/books/" : null;
    if (!prefix) throw new ProbeValidationError(`service must be "crm" or "books"`);
    if (typeof path !== "string" || !path.startsWith(prefix) || !PATH_PATTERN.test(path) || path.includes("..")) {
      throw new ProbeValidationError(`path must start with ${prefix} and contain only URL path characters`);
    }

    const url = new URL(opts.baseUrl + path);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
    if (service === "books" && !url.searchParams.has("organization_id")) {
      url.searchParams.set("organization_id", opts.booksOrgId);
    }

    const started = performance.now();
    const { status, body } = await zohoGet(opts.auth, url.toString(), opts.fetchImpl);
    return { url: url.toString(), status, durationMs: Math.round(performance.now() - started), body };
  };
}
