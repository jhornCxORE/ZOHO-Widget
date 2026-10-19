# Zoho Dashboard

A web dashboard combining **Zoho CRM** (deals and pipeline) and **Zoho Books** (invoices and receivables).

A small Node/Express server holds the Zoho credentials, calls both APIs, caches the results and serves
pre-computed metrics. A React frontend draws the charts. The browser never sees a Zoho token.

```
Browser (React + Chart.js)  ──/api/dashboard──▶  Express server  ──OAuth──▶  Zoho CRM v7
                                                 (metrics, cache)            Zoho Books v3
```

## Quick start (no Zoho account needed)

```bash
cd dashboard
npm install
cp .env.example .env      # DATA_MODE=mock by default
npm run dev
```

Open http://localhost:5173. The dashboard runs on generated sample data, marked with a "Sample data" badge.

## What's on the dashboard

| Section | Source | Notes |
|---|---|---|
| KPI tiles | CRM + Books | Open pipeline, won in range, win rate, invoiced/collected, outstanding and overdue A/R |
| Monthly bookings vs billing | CRM + Books | Won deal value by close month; invoiced and collected by invoice date |
| Open pipeline by stage | CRM | All open deals, in CRM stage order |
| Receivables aging | Books | Unpaid balance in Current / 1–30 / 31–60 / 61–90 / 90+ days past due |
| Largest outstanding balances | Books | Top 10 customers by unpaid amount |

Every chart has a "Show table" toggle with the underlying numbers. The range picker (3/6/12 months, YTD, custom)
filters the time-based figures. The pipeline, outstanding and overdue figures are always as of today.

## Connecting to real Zoho data

1. Go to the Zoho API console for your data center (https://api-console.zoho.com, or `.eu`, `.in`, `.com.au`, …)
   and create a **Self Client**.
2. Put its Client ID and Secret in `.env` (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`), and set `ZOHO_DC` to your data center.
3. Run `npm run zoho:token` to print the required scopes. In the Self Client's **Generate Code** tab, paste them
   and generate a code.
4. Run `npm run zoho:token -- <code>` and copy the printed `ZOHO_REFRESH_TOKEN=...` line into `.env`.
5. Set `ZOHO_BOOKS_ORG_ID` (Books → Settings → Organization Profile, or run the "Books: organizations" preset in
   the API tester).
6. Set `DATA_MODE=live` and restart `npm run dev`.

The token only needs read scopes. The server caches Zoho results for `CACHE_TTL_SECONDS` (default 5 minutes) to stay
within Zoho's daily API limits. The dashboard's **Refresh** button bypasses the cache.

## Testing

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Vitest): metrics math, OAuth token refresh, CRM/Books pagination and error handling, API routes, cache |
| `npm run test:e2e` | Browser tests (Playwright): builds the app, starts it in mock mode, checks KPIs, charts, range picker, error state, mobile layout, API tester |
| `npm run typecheck` | TypeScript check across server, frontend and tests |
| **API tester** at `/api-tester.html` | Sends read-only GET requests to any CRM or Books endpoint with the server's credentials and shows the raw JSON. Use it to look up field names or debug live data. Live mode only |

None of the tests call Zoho. HTTP calls are replaced with canned responses, so they run anywhere, including CI
(`.github/workflows/dashboard.yml`).

The API tester is on by default in development and **off in production**. Only enable it (`ENABLE_API_TESTER=true`)
behind authentication, because it lets anyone who can reach the page read your Zoho data.

## Project layout

```
dashboard/
├── src/
│   ├── shared/types.ts          # Types used by both server and frontend
│   └── server/
│       ├── index.ts             # Entry point: reads .env, wires up the provider, starts Express
│       ├── app.ts               # Routes: /api/health, /api/dashboard, /api/deals, /api/invoices, /api/zoho
│       ├── config.ts            # Env var parsing and validation
│       ├── metrics.ts           # Pure functions: raw records -> dashboard numbers
│       ├── data/
│       │   ├── provider.ts      # DataProvider interface + Mock/Live/Cached implementations
│       │   └── mock.ts          # Seeded sample-data generator
│       └── zoho/
│           ├── auth.ts          # Refresh-token -> access-token exchange and caching
│           ├── http.ts          # Authenticated GET with retry-on-401
│           ├── crm.ts           # CRM v7 client (Deals)
│           ├── books.ts         # Books v3 client (invoices)
│           └── probe.ts         # Backs the API tester page
├── web/
│   ├── index.html, api-tester.html
│   └── src/                     # React app, chart components, styles (light + dark)
├── tests/
│   ├── unit/                    # Vitest
│   └── e2e/                     # Playwright
└── scripts/get-refresh-token.ts
```

## Production

```bash
npm run build                    # builds the frontend into web/dist
NODE_ENV=production npm start    # serves the API and the built frontend on $PORT
```

The dashboard has **no login of its own**. Before deploying it anywhere public, put it behind authentication,
for example your host's access control, an auth proxy, or SSO. Treat `.env` as a secret.

## Extending

- **More CRM data** (leads, activities, …): add a fetch method to `zoho/crm.ts` (`getAllRecords("Leads", [...fields])`),
  expose it through `DataProvider`, add a generator to `mock.ts`, then compute the metric in `metrics.ts` with a unit test.
- **More Books data** (payments, expenses, …): same pattern via `BooksClient.getAll("customerpayments")`.
- **Currency**: `web/src/format.ts` assumes USD.
