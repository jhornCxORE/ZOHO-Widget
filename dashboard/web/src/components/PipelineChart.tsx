import { Bar } from "react-chartjs-2";
import type { StageBucket } from "../../../src/shared/types";
import type { ThemeColors } from "../theme";
import { fmtMoney } from "../format";
import { baseOptions } from "./charts";

export function PipelineChart({ data, colors }: { data: StageBucket[]; colors: ThemeColors }) {
  const options = baseOptions<"bar">(colors, { horizontal: true });
  options.indexAxis = "y";
  options.plugins!.tooltip!.callbacks!.afterLabel = (ctx) => `${data[ctx.dataIndex].count} deals`;
  return (
    <div className="card" data-testid="chart-pipeline">
      <h2>Open pipeline by stage</h2>
      <div className="subtle">Zoho CRM · all open deals</div>
      <div className="chart">
        <Bar
          aria-label="Open pipeline value by deal stage"
          options={options}
          data={{
            labels: data.map((d) => d.stage),
            datasets: [
              {
                label: "Pipeline",
                data: data.map((d) => d.amount),
                backgroundColor: colors.series[0],
                borderRadius: 4,
                borderSkipped: "start",
                maxBarThickness: 26,
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
              <tr><th>Stage</th><th className="num">Deals</th><th className="num">Value</th></tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.stage}><td>{d.stage}</td><td className="num">{d.count}</td><td className="num">{fmtMoney(d.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
