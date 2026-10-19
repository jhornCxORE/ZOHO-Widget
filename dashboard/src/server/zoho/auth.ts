// Exchanges the long-lived refresh token for short-lived access tokens
// (Zoho access tokens last one hour) and caches them until shortly before expiry.

import { accountsUrl, type ZohoDataCenter } from "../config.js";

export interface ZohoAuthOptions {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  dc: ZohoDataCenter;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export class ZohoAuthError extends Error {}

/** Refresh this many ms before the token actually expires. */
const EXPIRY_MARGIN_MS = 60_000;

export class ZohoAuth {
  private token: { value: string; expiresAt: number } | null = null;
  private inFlight: Promise<string> | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly opts: ZohoAuthOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? Date.now;
  }

  async getAccessToken(): Promise<string> {
    if (this.token && this.now() < this.token.expiresAt) return this.token.value;
    // Collapse concurrent refreshes into one request.
    this.inFlight ??= this.refresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Drop the cached token, e.g. after the API rejects it with a 401. */
  invalidate(): void {
    this.token = null;
  }

  private async refresh(): Promise<string> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.opts.clientId,
      client_secret: this.opts.clientSecret,
      refresh_token: this.opts.refreshToken,
    });
    const res = await this.fetchImpl(`${accountsUrl(this.opts.dc)}/oauth/v2/token`, {
      method: "POST",
      body: params,
    });
    // Zoho reports some failures (e.g. invalid_client) with HTTP 200 and an `error` field.
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok || !body.access_token) {
      throw new ZohoAuthError(`Zoho token refresh failed (HTTP ${res.status}): ${body.error ?? "no access_token"}`);
    }
    this.token = {
      value: body.access_token,
      expiresAt: this.now() + (body.expires_in ?? 3600) * 1000 - EXPIRY_MARGIN_MS,
    };
    return body.access_token;
  }
}
