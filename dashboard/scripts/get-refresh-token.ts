// One-time setup: exchanges a Self Client grant code for a long-lived refresh token.
//
//   1. Create a "Self Client" at https://api-console.zoho.com (use your data center's
//      console, e.g. api-console.zoho.eu, if your account isn't on .com).
//   2. Put its Client ID and Client Secret in .env as ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET.
//   3. In the Self Client's "Generate Code" tab, paste the scopes printed below,
//      pick a duration (10 minutes is plenty) and generate a code.
//   4. Run: npm run zoho:token -- <code>
//   5. Copy the printed refresh token into .env as ZOHO_REFRESH_TOKEN.

import "dotenv/config";
import { accountsUrl, ZOHO_DATA_CENTERS, type ZohoDataCenter } from "../src/server/config.js";

export const SCOPES = [
  "ZohoCRM.modules.deals.READ",
  "ZohoCRM.users.READ",
  "ZohoCRM.settings.READ",
  "ZohoBooks.invoices.READ",
  "ZohoBooks.contacts.READ",
  "ZohoBooks.settings.READ",
];

async function main() {
  const code = process.argv[2];
  const { ZOHO_CLIENT_ID: clientId, ZOHO_CLIENT_SECRET: clientSecret } = process.env;
  const dc = (process.env.ZOHO_DC ?? "com") as ZohoDataCenter;

  if (!code) {
    console.log("Scopes to paste into the Self Client's Generate Code tab:\n");
    console.log(`  ${SCOPES.join(",")}\n`);
    console.log("Then run: npm run zoho:token -- <code>");
    process.exit(1);
  }
  if (!clientId || !clientSecret) {
    console.error("Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in .env first.");
    process.exit(1);
  }
  if (!ZOHO_DATA_CENTERS.includes(dc)) {
    console.error(`ZOHO_DC must be one of ${ZOHO_DATA_CENTERS.join(", ")}`);
    process.exit(1);
  }

  const res = await fetch(`${accountsUrl(dc)}/oauth/v2/token`, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, code }),
  });
  const body = (await res.json()) as { refresh_token?: string; error?: string; api_domain?: string };
  if (!body.refresh_token) {
    console.error(`Zoho did not return a refresh token: ${body.error ?? JSON.stringify(body)}`);
    console.error("Grant codes expire quickly and work once; generate a fresh one and retry.");
    process.exit(1);
  }
  console.log("Add this line to .env:\n");
  console.log(`ZOHO_REFRESH_TOKEN=${body.refresh_token}\n`);
  if (body.api_domain) console.log(`(API domain for this account: ${body.api_domain})`);
}

void main();
