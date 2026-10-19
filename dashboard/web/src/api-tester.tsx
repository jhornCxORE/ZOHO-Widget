// Developer page for trying Zoho API calls through the server's credentials
// and seeing the raw JSON — useful for finding field names before using them.

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ZohoProbeRequest, ZohoProbeResponse } from "../../src/shared/types";
import { getHealth, probeZoho } from "./api";
import "./styles.css";

const PRESETS: { label: string; req: ZohoProbeRequest }[] = [
  { label: "CRM: current user", req: { service: "crm", path: "/crm/v7/users", query: { type: "CurrentUser" } } },
  { label: "CRM: modules", req: { service: "crm", path: "/crm/v7/settings/modules" } },
  { label: "CRM: deal fields", req: { service: "crm", path: "/crm/v7/settings/fields", query: { module: "Deals" } } },
  {
    label: "CRM: 5 deals",
    req: { service: "crm", path: "/crm/v7/Deals", query: { fields: "Deal_Name,Stage,Amount,Closing_Date", per_page: "5" } },
  },
  { label: "Books: organizations", req: { service: "books", path: "/books/v3/organizations" } },
  { label: "Books: 5 invoices", req: { service: "books", path: "/books/v3/invoices", query: { per_page: "5" } } },
  { label: "Books: 5 customers", req: { service: "books", path: "/books/v3/contacts", query: { per_page: "5" } } },
];

const toLines = (q: Record<string, string> = {}) => Object.entries(q).map(([k, v]) => `${k}=${v}`).join("\n");
const fromLines = (s: string) =>
  Object.fromEntries(
    s
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );

function ApiTester() {
  const [service, setService] = useState<ZohoProbeRequest["service"]>("crm");
  const [path, setPath] = useState("/crm/v7/users");
  const [query, setQuery] = useState("type=CurrentUser");
  const [result, setResult] = useState<ZohoProbeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    getHealth().then((h) => setMode(h.mode), () => setMode(null));
  }, []);

  const applyPreset = (r: ZohoProbeRequest) => {
    setService(r.service);
    setPath(r.path);
    setQuery(toLines(r.query));
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await probeZoho({ service, path, query: fromLines(query) }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const ok = result && result.status >= 200 && result.status < 300;

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>Zoho API Tester{mode && <span className={`badge ${mode}`}>{mode === "mock" ? "Sample data mode" : "Live"}</span>}</h1>
          <div className="subtle">
            Read-only GET requests using the server's Zoho credentials · <a href="/">Back to dashboard</a>
          </div>
        </div>
      </header>

      <div className="card">
        <form className="tester-form" onSubmit={send}>
          <div className="presets" aria-label="Presets">
            {PRESETS.map((p) => (
              <button type="button" key={p.label} onClick={() => applyPreset(p.req)}>{p.label}</button>
            ))}
          </div>
          <div className="row">
            <label>
              Service
              <select value={service} onChange={(e) => setService(e.target.value as ZohoProbeRequest["service"])}>
                <option value="crm">CRM</option>
                <option value="books">Books</option>
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 240 }}>
              Path
              <input type="text" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/crm/v7/Deals" />
            </label>
          </div>
          <label>
            Query parameters (one key=value per line; Books organization_id is added automatically)
            <textarea rows={3} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div>
            <button className="primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send GET"}</button>
          </div>
        </form>
      </div>

      {error && (
        <div className="error" role="alert" style={{ marginTop: 16 }}>
          <strong>Request failed.</strong> {error}
        </div>
      )}

      {result && (
        <div className="card" style={{ marginTop: 16 }} data-testid="probe-result">
          <div className="subtle">
            <span className={ok ? "status-ok" : "status-bad"}>HTTP {result.status}</span> · {result.durationMs} ms ·{" "}
            <code>{result.url}</code>
          </div>
          <pre className="response">{JSON.stringify(result.body, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApiTester />
  </StrictMode>,
);
