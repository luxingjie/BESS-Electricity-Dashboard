export type PeriodMode = "year" | "custom";

export const DEFAULT_ANALYTICS_YEAR = 2026;
export const ANALYTICS_YEAR_OPTIONS = [2026, 2025] as const;
export const MONTH_OPTIONS = [
  { value: 1, label: "1月" },
  { value: 2, label: "2月" },
  { value: 3, label: "3月" },
  { value: 4, label: "4月" },
  { value: 5, label: "5月" },
  { value: 6, label: "6月" },
  { value: 7, label: "7月" },
  { value: 8, label: "8月" },
  { value: 9, label: "9月" },
  { value: 10, label: "10月" },
  { value: 11, label: "11月" },
  { value: 12, label: "12月" },
] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateParam(value: string | null | undefined): value is string {
  if (!value || !DATE_RE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time);
}

export function yearBounds(year: number): { date_from: string; date_to: string } {
  return {
    date_from: `${year}-01-01`,
    date_to: `${year}-12-31`,
  };
}

export function monthBounds(
  year: number,
  month: number,
): { date_from: string; date_to: string } {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    date_from: `${year}-${mm}-01`,
    date_to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function resolvePeriodRange(input: {
  mode: PeriodMode;
  year: number;
  month: number | null;
  customFrom: string;
  customTo: string;
}): { date_from?: string; date_to?: string } {
  if (input.mode === "custom") {
    const from = isValidDateParam(input.customFrom) ? input.customFrom : undefined;
    const to = isValidDateParam(input.customTo) ? input.customTo : undefined;
    if (from && to && from > to) {
      return { date_from: to, date_to: from };
    }
    return { date_from: from, date_to: to };
  }

  // year mode — default presentation unit
  if (input.month) return monthBounds(input.year, input.month);
  return yearBounds(input.year);
}

export function formatPeriodLabel(input: {
  mode: PeriodMode;
  year: number;
  month: number | null;
  date_from?: string;
  date_to?: string;
}): string {
  if (input.mode === "custom") {
    if (input.date_from && input.date_to) {
      return `${input.date_from} ~ ${input.date_to}`;
    }
    return "自定义区间";
  }
  if (input.month) return `${input.year} 年 ${input.month} 月`;
  return `${input.year || DEFAULT_ANALYTICS_YEAR} 年`;
}
