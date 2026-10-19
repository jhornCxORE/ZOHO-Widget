import {
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import type { ThemeColors } from "../theme";
import { fmtMoney, fmtMoneyCompact } from "../format";

Chart.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

/** Shared look: recessive grid, compact money ticks, tooltips on hover. */
export function baseOptions<T extends "bar" | "line">(c: ThemeColors, opts: { horizontal?: boolean } = {}): ChartOptions<T> {
  const valueAxis = {
    beginAtZero: true,
    grid: { color: c.grid },
    border: { display: false },
    ticks: { callback: (v: string | number) => fmtMoneyCompact(Number(v)), maxTicksLimit: 6 },
  };
  const categoryAxis = { grid: { display: false }, border: { color: c.axis } };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: "index", intersect: false },
    scales: opts.horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: c.surface,
        titleColor: c.text,
        bodyColor: c.text,
        borderColor: c.axis,
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx: TooltipItem<"bar" | "line">) => {
            const v = opts.horizontal ? ctx.parsed.x : ctx.parsed.y;
            return `${ctx.dataset.label ? `${ctx.dataset.label}: ` : ""}${fmtMoney(v ?? 0)}`;
          },
        },
      },
    },
  } as unknown as ChartOptions<T>;
}
