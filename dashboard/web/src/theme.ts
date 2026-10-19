import { useEffect, useState } from "react";
import { Chart } from "chart.js";

export interface ThemeColors {
  series: [string, string, string];
  text: string;
  muted: string;
  grid: string;
  axis: string;
  surface: string;
}

function read(): ThemeColors {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    series: [v("--series-1"), v("--series-2"), v("--series-3")],
    text: v("--text-primary"),
    muted: v("--text-muted"),
    grid: v("--grid"),
    axis: v("--axis"),
    surface: v("--surface"),
  };
}

/** Chart.js paints to canvas, so it needs resolved colors; re-read them when the OS theme flips. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setColors(read());
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    Chart.defaults.color = colors.muted;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  }, [colors]);
  return colors;
}
