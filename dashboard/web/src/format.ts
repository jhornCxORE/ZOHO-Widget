// Change CURRENCY if your Zoho Books organization doesn't bill in USD.
export const CURRENCY = "USD";

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
const moneyCompact = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

export const fmtMoney = (n: number) => money.format(n);
export const fmtMoneyCompact = (n: number) => moneyCompact.format(n);
export const fmtPercent = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

/** "2026-03" -> "Mar 2026" */
export function fmtMonth(ym: string, short = false) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "short",
    year: short ? "2-digit" : "numeric",
    timeZone: "UTC",
  });
}

export function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
