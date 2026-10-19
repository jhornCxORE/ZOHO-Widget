import { Bar } from "react-chartjs-2";
import type { AgingBucket } from "../../../src/shared/types";
import type { ThemeColors } from "../theme";
import { fmtMoney } from "../format";
import { baseOptions } from "./charts";

export function AgingChart({ data, colors }: { data: AgingBucket[]; colors: ThemeColors }) {
  const options = baseOptions<"bar">(colors);
  options.plugins!.tooltip!.callbacks!.afterLabel = (ctx) => `${data[ctx.dataIndex].count} invoices`;
  return (
    <div className="card" data-testid="chart-aging">
      <h2>Receivables aging</h2>
      <div className="subtle">Zoho Books · unpaid balance by days past due</div>
      <div className="chart">
        <Bar
          aria-label="Unpaid invoice balance by days past due"
          options={options}
          data={{
            labels: data.map((b) => b.label),
            datasets: [
              {
                label: "Balance",
                data: data.map((b) => b.amount),
                backgroundColor: colors.series[0],
                borderRadius: 4,
                borderSkipped: "start",
                maxBarThickness: 48,
              },
            ],
          }}
        />
      </div>
      <details>
        <summary>Show table</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Age</th><th className="num">Invoices</th><th className="num">Balance</th></tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.label}><td>{b.label}</td><td className="num">{b.count}</td><td className="num">{fmtMoney(b.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
