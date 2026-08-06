import outlook from "@/data/sp-global-storage-outlook.json";

export type SpOutlookUnit = "gw" | "gwh";

export type SpOutlookRow = {
  year: number;
  region_en: string;
  region_zh: string;
  value: number;
};

export type SpOutlookDataset = {
  source_name: string;
  source_product: string;
  concept: string;
  vintage: string;
  geography_note: string;
  units: { power: string; energy: string };
  regions: Array<{ key: string; label_en: string; label_zh: string }>;
  years: number[];
  power_mw: SpOutlookRow[];
  energy_mwh: SpOutlookRow[];
};

export const SP_GLOBAL_STORAGE_OUTLOOK = outlook as SpOutlookDataset;

export const SP_OUTLOOK_DEFAULT_YEAR = 2026;

/** Stable palette for S&P Major regions (stacked bars + legend). */
export const SP_OUTLOOK_REGION_COLORS: Record<string, string> = {
  "Asia-Pacific": "#0b7a3b",
  "North America": "#2f9e57",
  "Europe (EU-27)": "#5bbf7a",
  "Europe (non EU-27)": "#8fd4a4",
  "Latin America": "#c4a35a",
  "Middle East": "#d0894a",
  Africa: "#7a807b",
};

export function spOutlookRowsForUnit(unit: SpOutlookUnit): SpOutlookRow[] {
  return unit === "gw"
    ? SP_GLOBAL_STORAGE_OUTLOOK.power_mw
    : SP_GLOBAL_STORAGE_OUTLOOK.energy_mwh;
}

/** Convert native MW / MWh values to GW / GWh for display. */
export function toDisplayCapacity(valueMwOrMwh: number): number {
  return valueMwOrMwh / 1000;
}

export function formatSpCapacity(valueGwOrGwh: number): string {
  if (!Number.isFinite(valueGwOrGwh) || valueGwOrGwh <= 0) return "0";
  if (valueGwOrGwh >= 100) return valueGwOrGwh.toFixed(0);
  if (valueGwOrGwh >= 10) return valueGwOrGwh.toFixed(1);
  return valueGwOrGwh.toFixed(2);
}
