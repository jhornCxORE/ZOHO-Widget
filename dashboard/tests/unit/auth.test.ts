import { describe, expect, it } from "vitest";
import { ZohoAuth, ZohoAuthError } from "../../src/server/zoho/auth";
import { fakeFetch } from "./helpers";

const creds = { clientId: "cid", clientSecret: "secret", refreshToken: "rt", dc: "com" as const };

describe("ZohoAuth", () => {
  it("posts the refresh token to the data center's accounts server", async () => {
    const f = fakeFetch([{ body: { access_token: "tok1", expires_in: 3600 } }]);
    const auth = new ZohoAuth({ ...creds, dc: "eu", fetchImpl: f.fn });
    expect(await auth.getAccessToken()).toBe("tok1");
    expect(f.calls[0].url).toBe("https://accounts.zoho.eu/oauth/v2/token");
    const body = new URLSearchParams(String(f.calls[0].init?.body));
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt");
  });

  it("reuses the token until shortly before it expires", async () => {
    let now = 0;
    const f = fakeFetch([
      { body: { access_token: "tok1", expires_in: 3600 } },
      { body: { access_token: "tok2", expires_in: 3600 } },
    ]);
    const auth = new ZohoAuth({ ...creds, fetchImpl: f.fn, now: () => now });
    expect(await auth.getAccessToken()).toBe("tok1");
    now = 3_000_000; // 50 min
    expect(await auth.getAccessToken()).toBe("tok1");
    now = 3_550_000; // inside the 60s safety margin
    expect(await auth.getAccessToken()).toBe("tok2");
    expect(f.calls).toHaveLength(2);
  });

  it("collapses concurrent refreshes into one request", async () => {
    const f = fakeFetch([{ body: { access_token: "tok1", expires_in: 3600 } }]);
    const auth = new ZohoAuth({ ...creds, fetchImpl: f.fn });
    const tokens = await Promise.all([auth.getAccessToken(), auth.getAccessToken(), auth.getAccessToken()]);
    expect(tokens).toEqual(["tok1", "tok1", "tok1"]);
    expect(f.calls).toHaveLength(1);
  });

  it("throws when Zoho returns an error with HTTP 200", async () => {
    const f = fakeFetch([{ body: { error: "invalid_client" } }]);
    const auth = new ZohoAuth({ ...creds, fetchImpl: f.fn });
    await expect(auth.getAccessToken()).rejects.toThrow(ZohoAuthError);
  });

  it("refreshes again after invalidate()", async () => {
    const f = fakeFetch([
      { body: { access_token: "tok1", expires_in: 3600 } },
      { body: { access_token: "tok2", expires_in: 3600 } },
    ]);
    const auth = new ZohoAuth({ ...creds, fetchImpl: f.fn });
    await auth.getAccessToken();
    auth.invalidate();
    expect(await auth.getAccessToken()).toBe("tok2");
  });
});
