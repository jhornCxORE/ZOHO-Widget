import type { Summary } from "../../../src/shared/types";
import { fmtMoney, fmtPercent } from "../format";

export function KpiGrid({ s }: { s: Summary }) {
  const tiles = [
    { id: "pipeline", label: "Open pipeline", value: fmtMoney(s.openPipelineValue), note: `${s.openDealCount} open deals` },
    { id: "won", label: "Won in range", value: fmtMoney(s.wonValue), note: `${s.wonCount} deals` },
    { id: "winrate", label: "Win rate", value: fmtPercent(s.winRate), note: "won ÷ closed in range" },
    { id: "invoiced", label: "Invoiced in range", value: fmtMoney(s.invoicedValue), note: `${fmtMoney(s.collectedValue)} collected` },
    { id: "outstanding", label: "Outstanding A/R", value: fmtMoney(s.outstandingValue), note: "all unpaid invoices" },
    {
      id: "overdue",
      label: "Overdue A/R",
      value: fmtMoney(s.overdueValue),
      note: "past due date",
      critical: s.overdueValue > 0,
    },
  ];
  return (
    <section className="kpis" aria-label="Key metrics">
      {tiles.map((t) => (
        <div className="kpi" key={t.id} data-testid={`kpi-${t.id}`}>
          <div className="label">{t.label}</div>
          <div className={`value${t.critical ? " critical" : ""}`}>{t.value}</div>
          <div className="note">{t.note}</div>
        </div>
      ))}
    </section>
  );
}
