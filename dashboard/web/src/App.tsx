import { useCallback, useEffect, useState } from "react";
import type { DashboardData, DateRange } from "../../src/shared/types";
import { getDashboard, RequestError } from "./api";
import { AgingChart } from "./components/AgingChart";
import { KpiGrid } from "./components/KpiGrid";
import { MonthlyChart } from "./components/MonthlyChart";
import { OutstandingTable } from "./components/OutstandingTable";
import { PipelineChart } from "./components/PipelineChart";
import { isoDate } from "./format";
import { useThemeColors } from "./theme";

type Preset = "3m" | "6m" | "12m" | "ytd" | "custom";

function presetRange(p: Exclude<Preset, "custom">, today = new Date()): DateRange {
  const to = isoDate(today);
  if (p === "ytd") return { from: `${today.getFullYear()}-01-01`, to };
  const months = { "3m": 3, "6m": 6, "12m": 12 }[p];
  const from = new Date(today);
  from.setMonth(from.getMonth() - months);
  from.setDate(from.getDate() + 1);
  return { from: isoDate(from), to };
}

export function App() {
  const colors = useThemeColors();
  const [preset, setPreset] = useState<Preset>("12m");
  const [range, setRange] = useState<DateRange>(() => presetRange("12m"));
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<RequestError | Error | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        setData(await getDashboard(range, refresh));
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    },
    [range],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>
            Zoho Dashboard
            {data && (
              <span className={`badge ${data.mode}`} data-testid="mode-badge">
                {data.mode === "mock" ? "Sample data" : "Live data"}
              </span>
            )}
          </h1>
          <div className="subtle">
            CRM + Books
            {data && ` · updated ${new Date(data.generatedAt).toLocaleTimeString()}`}
            {" · "}
            <a href="/api-tester.html">API tester</a>
          </div>
        </div>
        <div className="controls">
          <label className="subtle" htmlFor="range-preset">Range</label>
          <select id="range-preset" value={preset} onChange={(e) => choosePreset(e.target.value as Preset)}>
            <option value="3m">Last 3 months</option>
            <option value="6m">Last 6 months</option>
            <option value="12m">Last 12 months</option>
            <option value="ytd">Year to date</option>
            <option value="custom">Custom…</option>
          </select>
          {preset === "custom" && (
            <>
              <input type="date" aria-label="From" value={range.from} max={range.to}
                onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} />
              <input type="date" aria-label="To" value={range.to} min={range.from}
                onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} />
            </>
          )}
          <button onClick={() => load(true)} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="error" role="alert">
          <strong>Couldn't load the dashboard.</strong> {error.message}
        </div>
      )}

      {!data && !error && <div className="loading">Loading…</div>}

      {data && (
        <main aria-busy={loading}>
          <KpiGrid s={data.summary} />
          <div className="grid">
            <MonthlyChart data={data.monthly} colors={colors} />
            <PipelineChart data={data.pipeline} colors={colors} />
            <AgingChart data={data.arAging} colors={colors} />
            <OutstandingTable rows={data.topOutstanding} />
          </div>
        </main>
      )}
    </div>
  );
}
