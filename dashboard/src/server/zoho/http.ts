import type { ZohoAuth } from "./auth.js";

export class ZohoApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

export interface ZohoResponse {
  status: number;
  /** Parsed JSON, or null for empty responses (CRM returns 204 when there are no records). */
  body: unknown;
}

/**
 * Authenticated GET against a Zoho API. Retries once with a fresh token on 401,
 * and returns non-2xx responses rather than throwing so callers can decide.
 */
export async function zohoGet(auth: ZohoAuth, url: string, fetchImpl: typeof fetch = fetch): Promise<ZohoResponse> {
  for (let attempt = 0; ; attempt++) {
    const token = await auth.getAccessToken();
    const res = await fetchImpl(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
    if (res.status === 401 && attempt === 0) {
      auth.invalidate();
      continue;
    }
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { status: res.status, body };
  }
}

/** Like zohoGet, but throws ZohoApiError on non-2xx responses. */
export async function zohoGetOk(auth: ZohoAuth, url: string, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const { status, body } = await zohoGet(auth, url, fetchImpl);
  if (status < 200 || status >= 300) {
    const msg = (body as { message?: string } | null)?.message ?? `HTTP ${status}`;
    throw new ZohoApiError(`Zoho API request failed: ${msg}`, status, body);
  }
  return body;
}
