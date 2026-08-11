#!/usr/bin/env node
/**
 * Rebuild src/data/sp-global-storage-outlook.json from S&P Global Excel exports.
 *
 * Usage:
 *   node scripts/import-sp-global-storage-outlook.mjs \
 *     "/path/to/Gross capacity additions (MW-ac).xlsx" \
 *     "/path/to/Gross capacity additions (MWh).xlsx"
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const REGION_ZH = {
  "Asia-Pacific": "亚太",
  "North America": "北美",
  "Europe (EU-27)": "欧洲（欧盟27）",
  "Europe (non EU-27)": "欧洲（非欧盟）",
  "Latin America": "拉丁美洲",
  "Middle East": "中东",
  Africa: "非洲",
};
const REGION_ORDER = Object.keys(REGION_ZH);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "src/data/sp-global-storage-outlook.json");

function cellText(value) {
  if (value == null) return null;
  if (typeof value === "object" && "result" in value) return cellText(value.result);
  if (typeof value === "object" && "text" in value) return String(value.text);
  return value;
}

async function loadSheet(filePath) {
  const workbook = new ExcelJS.Workbook();
  // Some S&P exports omit cell refs; read via openpyxl-equivalent by unzip if needed.
  // Prefer ExcelJS model when possible.
  try {
    await workbook.xlsx.readFile(filePath);
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error(`No sheet in ${filePath}`);

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      values[col - 1] = cellText(cell.value);
    });
    rows[rowNumber - 1] = values;
  });
  return rows.filter(Boolean);
}

async function loadRows(filePath) {
  // Fallback parser for sheets without cell references (common in S&P exports).
  const { execFileSync } = await import("node:child_process");
  const script = `
from openpyxl import load_workbook
import json, sys
wb = load_workbook(sys.argv[1], data_only=True)
ws = wb.active
rows = [list(r) for r in ws.iter_rows(values_only=True)]
print(json.dumps(rows, ensure_ascii=False))
`;
  const raw = execFileSync("python3", ["-c", script, filePath], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

function toSeries(rows) {
  const meta = rows[0]?.[0] ?? "";
  const data = [];
  for (const row of rows.slice(3)) {
    const [year, region, value] = row;
    if (year == null || region == null || value == null) continue;
    data.push({
      year: Number(year),
      region_en: String(region),
      region_zh: REGION_ZH[String(region)] ?? String(region),
      value: Math.round(Number(value) * 1000) / 1000,
    });
  }
  return { meta: String(meta), data };
}

async function main() {
  const [mwPath, mwhPath] = process.argv.slice(2);
  if (!mwPath || !mwhPath) {
    console.error(
      "Usage: node scripts/import-sp-global-storage-outlook.mjs <mw.xlsx> <mwh.xlsx>",
    );
    process.exit(1);
  }

  const power = toSeries(await loadRows(mwPath));
  const energy = toSeries(await loadRows(mwhPath));
  const years = [...new Set(power.data.map((row) => row.year))].sort(
    (a, b) => a - b,
  );

  const payload = {
    source_name: "S&P Global Commodity Insights",
    source_product: "Energy Storage Market Outlook",
    concept: "Gross capacity additions",
    vintage: "Latest forecast",
    geography_note:
      "Major region taxonomy from S&P Global; independent of this dashboard region tree.",
    units: { power: "MW-ac", energy: "MWh" },
    regions: REGION_ORDER.map((key) => ({
      key,
      label_en: key,
      label_zh: REGION_ZH[key],
    })),
    years,
    power_mw: power.data,
    energy_mwh: energy.data,
    filters_power: power.meta,
    filters_energy: energy.meta,
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${outPath} (${power.data.length} power rows, ${energy.data.length} energy rows)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
