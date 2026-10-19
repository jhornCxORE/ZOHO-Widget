import { Line } from "react-chartjs-2";
import type { MonthPoint } from "../../../src/shared/types";
import type { ThemeColors } from "../theme";
import { fmtMoney, fmtMonth } from "../format";
import { baseOptions } from "./charts";

const SERIES = [
  { key: "wonValue", label: "Deals won (CRM)" },
  { key: "invoicedValue", label: "Invoiced (Books)" },
  { key: "collectedValue", label: "Collected (Books)" },
] as const;

export function MonthlyChart({ data, colors }: { data: MonthPoint[]; colors: ThemeColors }) {
  const options = baseOptions<"line">(colors);
  options.plugins!.legend = {
    display: true,
    position: "top",
    align: "start",
    labels: { color: colors.text, usePointStyle: true, pointStyle: "line", boxWidth: 18 },
  };
  return (
    <div className="card wide" data-testid="chart-monthly">
      <h2>Monthly bookings vs billing</h2>
      <div className="subtle">Won deal value by close month; invoices by issue date, with the paid portion as collected</div>
      <div className="chart">
        <Line
          aria-label="Monthly won deals, invoiced and collected amounts"
          options={options}
          data={{
            labels: data.map((p) => fmtMonth(p.month, true)),
            datasets: SERIES.map((s, i) => ({
              label: s.label,
              data: data.map((p) => p[s.key]),
              borderColor: colors.series[i],
              backgroundColor: colors.series[i],
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointHoverBorderColor: colors.surface,
              pointHoverBorderWidth: 2,
              cubicInterpolationMode: "monotone",
            })),
          }}
        />
      </div>
      <details>
        <summary>Show table</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Month</th>{SERIES.map((s) => <th className="num" key={s.key}>{s.label}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.month}>
                  <td>{fmtMonth(p.month)}</td>
                  {SERIES.map((s) => <td className="num" key={s.key}>{fmtMoney(p[s.key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
