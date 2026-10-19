import "dotenv/config";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { apiUrl, ConfigError, loadConfig } from "./config.js";
import { CachedProvider, LiveProvider, MockProvider, type DataProvider } from "./data/provider.js";
import { toIsoDate } from "./metrics.js";
import { ZohoAuth } from "./zoho/auth.js";
import { BooksClient } from "./zoho/books.js";
import { CrmClient } from "./zoho/crm.js";
import { createProbe, type Probe } from "./zoho/probe.js";

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`Configuration error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  let provider: DataProvider;
  let probe: Probe | null = null;

  if (config.zoho) {
    const z = config.zoho;
    const auth = new ZohoAuth({ clientId: z.clientId, clientSecret: z.clientSecret, refreshToken: z.refreshToken, dc: z.dc });
    const base = apiUrl(z.dc);
    provider = new CachedProvider(
      new LiveProvider(new CrmClient(auth, base), new BooksClient(auth, base, z.booksOrgId)),
      config.cacheTtlSeconds * 1000,
    );
    if (config.enableApiTester) probe = createProbe({ auth, baseUrl: base, booksOrgId: z.booksOrgId });
  } else {
    provider = new MockProvider(toIsoDate(new Date()));
  }

  const app = createApp({
    provider,
    probe,
    staticDir: config.production ? fileURLToPath(new URL("../../web/dist", import.meta.url)) : undefined,
  });

  app.listen(config.port, () => {
    console.log(`Zoho dashboard API on http://localhost:${config.port} (data: ${config.mode})`);
    if (!config.production) console.log("Frontend dev server: http://localhost:5173");
  });
}

main();
