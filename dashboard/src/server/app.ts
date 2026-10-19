import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import type { DateRange, ZohoProbeRequest } from "../shared/types.js";
import type { DataProvider } from "./data/provider.js";
import { buildDashboard, defaultRange, toIsoDate } from "./metrics.js";
import { ZohoAuthError } from "./zoho/auth.js";
import { ZohoApiError } from "./zoho/http.js";
import { ProbeValidationError, type Probe } from "./zoho/probe.js";

export interface AppDeps {
  provider: DataProvider;
  /** Null disables the /api/zoho passthrough. */
  probe: Probe | null;
  /** Today's date as YYYY-MM-DD; injectable for tests. */
  today?: () => string;
  /** Built frontend to serve (production). */
  staticDir?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 5 * 366;

class BadRequest extends Error {}

function parseRange(req: Request, today: string): DateRange {
  const { from, to } = req.query;
  if (from === undefined && to === undefined) return defaultRange(today);
  if (typeof from !== "string" || typeof to !== "string" || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    throw new BadRequest("from and to must both be dates in YYYY-MM-DD format");
  }
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) throw new BadRequest("from/to is not a valid date");
  if (fromMs > toMs) throw new BadRequest("from must be on or before to");
  if ((toMs - fromMs) / 86_400_000 > MAX_RANGE_DAYS) throw new BadRequest("range may be at most 5 years");
  return { from, to };
}

export function createApp({ provider, probe, today = () => toIsoDate(new Date()), staticDir }: AppDeps) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, mode: provider.mode, apiTester: probe !== null });
  });

  app.get("/api/dashboard", async (req, res, next) => {
    try {
      const asOf = today();
      const range = parseRange(req, asOf);
      if (req.query.refresh === "1") provider.clearCache?.();
      const [deals, invoices] = await Promise.all([provider.getDeals(), provider.getInvoices()]);
      res.json(buildDashboard(deals, invoices, { range, asOf, mode: provider.mode }));
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/deals", (_req, res, next) => {
    provider.getDeals().then((d) => res.json(d), next);
  });

  app.get("/api/invoices", (_req, res, next) => {
    provider.getInvoices().then((i) => res.json(i), next);
  });

  app.post("/api/zoho", async (req, res, next) => {
    if (!probe) {
      res.status(403).json({
        error:
          provider.mode === "mock"
            ? "The API tester needs live Zoho credentials. Set DATA_MODE=live in .env and restart."
            : "The API tester is disabled. Set ENABLE_API_TESTER=true to enable it.",
      });
      return;
    }
    try {
      res.json(await probe(req.body as ZohoProbeRequest));
    } catch (err) {
      next(err);
    }
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof BadRequest || err instanceof ProbeValidationError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof ZohoAuthError) {
      res.status(502).json({ error: err.message });
    } else if (err instanceof ZohoApiError) {
      res.status(502).json({ error: err.message, detail: err.body });
    } else {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return app;
}
