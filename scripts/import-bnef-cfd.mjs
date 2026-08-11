// One-off/rerunnable importer for the BNEF "China Contract for Difference
// Auction Database" workbook into public.china_cfd_auctions.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/import-bnef-cfd.mjs "/path/to/BNEF CfD Database.xlsx"
//
// The service-role key is only used by this trusted operator script; the app
// itself never needs it. Rows are upserted on the natural key
// (province_label, auction_round, delivery_year), so re-running with an
// updated workbook refreshes values without duplicating rows. Manual edits
// made in the admin UI to OTHER rows are preserved.

import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import {
  localizeCfdNote,
  localizeCommissioningWindow,
  localizePotDesign,
  localizeSourceName,
} from "./cfd-localize.mjs";

const [, , workbookPath] = process.argv;
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!workbookPath || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-bnef-cfd.mjs <xlsx path>",
  );
  process.exit(1);
}

const GRID_REGION_ZH = {
  North: "华北",
  Northeast: "东北",
  Northwest: "西北",
  Central: "华中",
  East: "华东",
  South: "南方",
};

const STATUS_ZH = {
  Completed: "已完成",
  None: "未启动",
  Ongoing: "进行中",
  Announced: "已公告",
};

// BNEF splits some provinces into grid areas; map them back to regions rows
// while keeping a distinct display label.
const SPECIAL_PROVINCES = {
  "North Hebei": { region: "Hebei", zh: "冀北" },
  "South Hebei": { region: "Hebei", zh: "冀南" },
  "East Inner Mongolia": { region: "Inner Mongolia", zh: "蒙东" },
  "West Inner Mongolia": { region: "Inner Mongolia", zh: "蒙西" },
  Tibet: { region: "Xizang", zh: "西藏" },
};

function cellValue(cell) {
  const value = cell.value;
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if (value.richText) return value.richText.map((part) => part.text).join("");
    if (value.hyperlink) return value.hyperlink;
    if (value.text != null) return value.text;
    if (value.result !== undefined) return value.result;
    return null;
  }
  return value;
}

function asNumber(raw) {
  if (raw == null || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function asText(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  return text === "" ? null : text;
}

function asDate(raw) {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const text = String(raw).trim();
  // BNEF uses US-style M/D/YYYY in text cells.
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, month, day, year] = us;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return null;
}

function asHttpUrl(raw) {
  const text = asText(raw);
  if (!text || !/^https?:\/\//i.test(text)) return null;
  return text;
}

function translateRound(raw) {
  const text = asText(raw);
  if (!text) return null;
  const match = text.match(/Round\s*(\d+)/i);
  return match ? `第${match[1]}轮` : text;
}

function asPercent(raw) {
  const value = asNumber(raw);
  if (value == null) return null;
  // Excel percent cells often come through as 0-1 fractions.
  return value > 0 && value <= 1 ? Number((value * 100).toFixed(2)) : value;
}

function emptyAuctionFields() {
  return {
    announcement_url: null,
    announcement_name: null,
    supplemental_url: null,
    supplemental_name: null,
    legacy_coverage_ratio: null,
    legacy_strike: null,
    legacy_duration_years: null,
    legacy_note: null,
    legacy_url: null,
  };
}

// The two sections of the "Auction results" sheet use different column
// layouts (the 2027 sub-table adds a discount column per tech block and has
// no LCOE columns for offshore wind), so each section gets its own map.
const COLUMNS_2025_2026 = {
  announcement: 3, year: 4, round: 5, window: 6, status: 7, pot: 8,
  onshoreFloor: 9, onshoreCap: 10, onshoreStrike: 11,
  offshoreFloor: 14, offshoreCap: 15, offshoreStrike: 16,
  solarFloor: 17, solarCap: 18, solarStrike: 19,
  coal: 22,
  target: 23, awarded: 25, subscription: 27,
  onshoreTarget: 28, onshoreAwarded: 30,
  offshoreTarget: 32, offshoreAwarded: 34,
  solarTarget: 36, solarAwarded: 38,
  durationOnshore: 40, durationOffshore: 41, durationSolar: 42,
  note: 43, link: 44,
};

const COLUMNS_2027 = {
  announcement: 3, year: 4, round: 5, window: 6, status: 7, pot: 8,
  onshoreFloor: 9, onshoreCap: 10, onshoreStrike: 11,
  offshoreFloor: 15, offshoreCap: 16, offshoreStrike: 17,
  solarFloor: 18, solarCap: 19, solarStrike: 20,
  coal: 24,
  target: 25, awarded: 27, subscription: 29,
  onshoreTarget: 30, onshoreAwarded: 32,
  offshoreTarget: 34, offshoreAwarded: 36,
  solarTarget: 38, solarAwarded: 40,
  durationOnshore: 42, durationOffshore: 43, durationSolar: 44,
  note: 45, link: 46,
};

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(workbookPath);
const sheet = workbook.getWorksheet("Auction results");
if (!sheet) {
  console.error("Worksheet 'Auction results' not found");
  process.exit(1);
}

const progressSheet = workbook.getWorksheet("Progress update");
const implementationPlansByProvinceZh = new Map();
if (progressSheet) {
  for (let r = 10; r <= progressSheet.rowCount; r += 1) {
    const row = progressSheet.getRow(r);
    const provinceRaw = asText(cellValue(row.getCell(2)));
    if (!provinceRaw) continue;
    const provinceEn = provinceRaw.replace(/\s*\(R\d+\)\s*$/i, "").trim();
    const special = SPECIAL_PROVINCES[provinceEn];
    const labelZh = special?.zh;
    const regionNameEn = special?.region ?? provinceEn;
    // Resolve Chinese label via special map or later via regions table.
    const planUrl = asHttpUrl(cellValue(row.getCell(6)));
    if (!planUrl) continue;
    implementationPlansByProvinceZh.set(provinceEn, {
      provinceEn,
      labelZh,
      regionNameEn,
      url: planUrl,
      name: "省级实施方案",
    });
  }
  console.log(
    `Parsed ${implementationPlansByProvinceZh.size} local implementation plan links from Progress update.`,
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: provinces, error: regionError } = await supabase
  .from("regions")
  .select("id,name_en,name_zh")
  .eq("region_type", "province");
if (regionError) {
  console.error("Failed to load regions:", regionError.message);
  process.exit(1);
}
const provincesByEn = new Map(provinces.map((region) => [region.name_en, region]));

function planForProvince(provinceEn, provinceLabelZh) {
  const plan =
    implementationPlansByProvinceZh.get(provinceEn) ??
    [...implementationPlansByProvinceZh.values()].find(
      (item) => item.labelZh === provinceLabelZh,
    );
  if (!plan) return { url: null, name: null };
  return { url: plan.url, name: plan.name };
}

const rows = [];
const skipped = [];
let currentGridRegion = null;
let columns = COLUMNS_2025_2026;

for (let r = 11; r <= sheet.rowCount; r += 1) {
  const row = sheet.getRow(r);
  const col = (index) => cellValue(row.getCell(index));

  const firstCell = asText(col(1));
  if (firstCell && /AUCTIONS$/i.test(firstCell)) {
    currentGridRegion = null;
    columns = firstCell.startsWith("2027") ? COLUMNS_2027 : COLUMNS_2025_2026;
    continue;
  }
  if (firstCell) currentGridRegion = firstCell;

  const provinceRaw = asText(col(2));
  if (!provinceRaw) continue;

  const provinceEn = provinceRaw.replace(/\s*\(R\d+\)\s*$/i, "").trim();
  const special = SPECIAL_PROVINCES[provinceEn];
  const regionNameEn = special?.region ?? provinceEn;
  const region = provincesByEn.get(regionNameEn);
  if (!region) {
    skipped.push(`row ${r}: unmapped province "${provinceRaw}"`);
    continue;
  }

  const provinceLabel = special?.zh ?? region.name_zh;
  const plan = planForProvince(provinceEn, provinceLabel);

  const record = {
    region_id: region.id,
    province_label: provinceLabel,
    province_label_en: provinceEn,
    grid_region: GRID_REGION_ZH[currentGridRegion] ?? asText(currentGridRegion),
    auction_round: translateRound(col(columns.round)),
    announcement_date: asDate(col(columns.announcement)),
    delivery_year: asNumber(col(columns.year)),
    commissioning_window: localizeCommissioningWindow(asText(col(columns.window))),
    status: STATUS_ZH[asText(col(columns.status))] ?? asText(col(columns.status)),
    pot_design: localizePotDesign(asText(col(columns.pot))),
    onshore_wind_floor: asNumber(col(columns.onshoreFloor)),
    onshore_wind_cap: asNumber(col(columns.onshoreCap)),
    onshore_wind_strike: asNumber(col(columns.onshoreStrike)),
    offshore_wind_floor: asNumber(col(columns.offshoreFloor)),
    offshore_wind_cap: asNumber(col(columns.offshoreCap)),
    offshore_wind_strike: asNumber(col(columns.offshoreStrike)),
    solar_floor: asNumber(col(columns.solarFloor)),
    solar_cap: asNumber(col(columns.solarCap)),
    solar_strike: asNumber(col(columns.solarStrike)),
    coal_benchmark: asNumber(col(columns.coal)),
    target_volume_gwh: asNumber(col(columns.target)),
    awarded_volume_gwh: asNumber(col(columns.awarded)),
    // Excel stores percent cells as fractions; convert to 0-100.
    subscription_rate:
      asNumber(col(columns.subscription)) == null
        ? null
        : Number((asNumber(col(columns.subscription)) * 100).toFixed(2)),
    onshore_wind_target_gwh: asNumber(col(columns.onshoreTarget)),
    onshore_wind_awarded_gwh: asNumber(col(columns.onshoreAwarded)),
    offshore_wind_target_gwh: asNumber(col(columns.offshoreTarget)),
    offshore_wind_awarded_gwh: asNumber(col(columns.offshoreAwarded)),
    solar_target_gwh: asNumber(col(columns.solarTarget)),
    solar_awarded_gwh: asNumber(col(columns.solarAwarded)),
    duration_years_onshore: asNumber(col(columns.durationOnshore)),
    duration_years_offshore: asNumber(col(columns.durationOffshore)),
    duration_years_solar: asNumber(col(columns.durationSolar)),
    note: localizeCfdNote(asText(col(columns.note))),
    source_url: asHttpUrl(col(columns.link)),
    source_name: asHttpUrl(col(columns.link))
      ? "结果公告"
      : localizeSourceName("BloombergNEF"),
    implementation_plan_url: plan.url,
    implementation_plan_name: plan.name,
    ...emptyAuctionFields(),
    is_demo: false,
    is_published: true,
  };

  // Keep the full Excel grid, including 2027 placeholder rows that only
  // carry coal benchmarks / delivery years before auctions are announced.
  rows.push(record);
}

function parseDurationYears(raw) {
  const text = asText(raw);
  if (!text) return { onshore: null, offshore: null, solar: null };
  if (/^\d+(\.\d+)?$/.test(text)) {
    const value = Number(text);
    return { onshore: value, offshore: value, solar: value };
  }
  const onshore = text.match(/onshore[^\d]*(\d+(\.\d+)?)/i);
  const offshore = text.match(/offshore[^\d]*(\d+(\.\d+)?)/i);
  const solar = text.match(/solar[^\d]*(\d+(\.\d+)?)/i);
  return {
    onshore: onshore ? Number(onshore[1]) : null,
    offshore: offshore ? Number(offshore[1]) : null,
    solar: solar ? Number(solar[1]) : null,
  };
}

function naturalKey(provinceLabel, auctionRound, deliveryYear) {
  return `${provinceLabel}||${auctionRound ?? ""}||${deliveryYear ?? ""}`;
}

// Overlay Auction terms so announced-but-incomplete results still get floor /
// cap / volume / announcement / reform-plan links from the terms sheet.
const termsSheet = workbook.getWorksheet("Auction terms");
let termsMerged = 0;
if (termsSheet) {
  const byKey = new Map(
    rows.map((row) => [
      naturalKey(row.province_label, row.auction_round, row.delivery_year),
      row,
    ]),
  );

  let termsRegion = null;
  for (let r = 11; r <= termsSheet.rowCount; r += 1) {
    const row = termsSheet.getRow(r);
    const col = (index) => cellValue(row.getCell(index));
    const firstCell = asText(col(1));
    if (firstCell && /AUCTIONS$/i.test(firstCell)) {
      termsRegion = null;
      continue;
    }
    if (firstCell) termsRegion = firstCell;

    const provinceRaw = asText(col(2));
    if (!provinceRaw) continue;
    const provinceEn = provinceRaw.replace(/\s*\(R\d+\)\s*$/i, "").trim();
    const special = SPECIAL_PROVINCES[provinceEn];
    const regionNameEn = special?.region ?? provinceEn;
    const region = provincesByEn.get(regionNameEn);
    if (!region) continue;

    const provinceLabel = special?.zh ?? region.name_zh;
    const auctionRound = translateRound(col(3));
    const deliveryYear = asNumber(col(4));
    const key = naturalKey(provinceLabel, auctionRound, deliveryYear);
    let target = byKey.get(key);
    if (!target) {
      // Terms-only stub (rare): create a published placeholder row.
      target = {
        region_id: region.id,
        province_label: provinceLabel,
        province_label_en: provinceEn,
        grid_region: GRID_REGION_ZH[termsRegion] ?? asText(termsRegion),
        auction_round: auctionRound,
        announcement_date: null,
        delivery_year: deliveryYear,
        commissioning_window: null,
        status: null,
        pot_design: null,
        onshore_wind_floor: null,
        onshore_wind_cap: null,
        onshore_wind_strike: null,
        offshore_wind_floor: null,
        offshore_wind_cap: null,
        offshore_wind_strike: null,
        solar_floor: null,
        solar_cap: null,
        solar_strike: null,
        coal_benchmark: null,
        target_volume_gwh: null,
        awarded_volume_gwh: null,
        subscription_rate: null,
        onshore_wind_target_gwh: null,
        onshore_wind_awarded_gwh: null,
        offshore_wind_target_gwh: null,
        offshore_wind_awarded_gwh: null,
        solar_target_gwh: null,
        solar_awarded_gwh: null,
        duration_years_onshore: null,
        duration_years_offshore: null,
        duration_years_solar: null,
        note: null,
        source_url: null,
        source_name: localizeSourceName("BloombergNEF"),
        implementation_plan_url: planForProvince(provinceEn, provinceLabel).url,
        implementation_plan_name: planForProvince(provinceEn, provinceLabel).name,
        ...emptyAuctionFields(),
        is_demo: false,
        is_published: true,
      };
      rows.push(target);
      byKey.set(key, target);
    }

    const floor = asNumber(col(10));
    const cap = asNumber(col(11));
    const totalVolume = asNumber(col(5));
    const windVolume = asNumber(col(6));
    const solarVolume = asNumber(col(7));
    const pot = localizePotDesign(asText(col(13)));
    const note = localizeCfdNote(asText(col(18)));
    const announcement = asHttpUrl(col(19));
    const reformPlan = asHttpUrl(col(20));
    const supplemental = asHttpUrl(col(21));
    const duration = parseDurationYears(col(9));

    if (target.onshore_wind_floor == null) target.onshore_wind_floor = floor;
    if (target.onshore_wind_cap == null) target.onshore_wind_cap = cap;
    if (target.solar_floor == null) target.solar_floor = floor;
    if (target.solar_cap == null) target.solar_cap = cap;
    if (target.target_volume_gwh == null) target.target_volume_gwh = totalVolume;
    if (target.onshore_wind_target_gwh == null) {
      target.onshore_wind_target_gwh = windVolume;
    }
    if (target.solar_target_gwh == null) target.solar_target_gwh = solarVolume;
    if (target.pot_design == null) target.pot_design = pot;
    if (target.duration_years_onshore == null) {
      target.duration_years_onshore = duration.onshore;
    }
    if (target.duration_years_offshore == null) {
      target.duration_years_offshore = duration.offshore;
    }
    if (target.duration_years_solar == null) {
      target.duration_years_solar = duration.solar;
    }
    if (announcement) {
      target.announcement_url = announcement;
      target.announcement_name = target.announcement_name ?? "竞价公告";
    }
    if (target.implementation_plan_url == null && reformPlan) {
      target.implementation_plan_url = reformPlan;
      target.implementation_plan_name = "改革/实施方案";
    }
    if (supplemental) {
      target.supplemental_url = supplemental;
      target.supplemental_name = target.supplemental_name ?? "补充文件";
    }
    if (note) {
      target.note = target.note ? `${target.note}；${note}` : note;
    }
    if (!target.grid_region && termsRegion) {
      target.grid_region = GRID_REGION_ZH[termsRegion] ?? termsRegion;
    }
    termsMerged += 1;
  }
}

// Overlay Legacy projects (prefer Chinese notes) onto matching province labels.
const legacySheetCn = workbook.getWorksheet("Legacy projects-CN");
const legacySheetEn = workbook.getWorksheet("Legacy projects-EN");
let legacyMerged = 0;

function readLegacySheet(sheet, preferTextCoverage) {
  if (!sheet) return;
  for (let r = 10; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const provinceRaw = asText(cellValue(row.getCell(2)));
    if (!provinceRaw) continue;
    const provinceEn = provinceRaw.replace(/\s*\(R\d+\)\s*$/i, "").trim();
    const special = SPECIAL_PROVINCES[provinceEn];
    const regionNameEn = special?.region ?? provinceEn;
    const region = provincesByEn.get(regionNameEn);
    if (!region) continue;
    const provinceLabel = special?.zh ?? region.name_zh;

    const coverageRaw = cellValue(row.getCell(3));
    const coverageRatio = asPercent(coverageRaw);
    const coverageText =
      coverageRatio == null ? asText(coverageRaw) : null;
    const strike = asNumber(cellValue(row.getCell(4)));
    const durationRaw = cellValue(row.getCell(5));
    const durationYears = asNumber(durationRaw);
    const durationText =
      durationYears == null ? asText(durationRaw) : null;
    const noteText = asText(cellValue(row.getCell(6)));
    const legacyUrl = asHttpUrl(cellValue(row.getCell(7)));

    const noteParts = [];
    if (preferTextCoverage && coverageText) {
      noteParts.push(`覆盖安排：${coverageText}`);
    }
    if (durationText) noteParts.push(`执行期限：${durationText}`);
    if (noteText) noteParts.push(noteText);
    const legacyNote = noteParts.length ? noteParts.join("；") : null;

    if (
      coverageRatio == null &&
      strike == null &&
      durationYears == null &&
      !legacyNote &&
      !legacyUrl
    ) {
      continue;
    }

    const matches = rows.filter((item) => item.province_label === provinceLabel);
    const targets = matches.length
      ? matches
      : [
          {
            region_id: region.id,
            province_label: provinceLabel,
            province_label_en: provinceEn,
            grid_region: null,
            auction_round: null,
            announcement_date: null,
            delivery_year: null,
            commissioning_window: null,
            status: null,
            pot_design: null,
            onshore_wind_floor: null,
            onshore_wind_cap: null,
            onshore_wind_strike: null,
            offshore_wind_floor: null,
            offshore_wind_cap: null,
            offshore_wind_strike: null,
            solar_floor: null,
            solar_cap: null,
            solar_strike: null,
            coal_benchmark: null,
            target_volume_gwh: null,
            awarded_volume_gwh: null,
            subscription_rate: null,
            onshore_wind_target_gwh: null,
            onshore_wind_awarded_gwh: null,
            offshore_wind_target_gwh: null,
            offshore_wind_awarded_gwh: null,
            solar_target_gwh: null,
            solar_awarded_gwh: null,
            duration_years_onshore: null,
            duration_years_offshore: null,
            duration_years_solar: null,
            note: null,
            source_url: null,
            source_name: localizeSourceName("BloombergNEF"),
            implementation_plan_url: planForProvince(provinceEn, provinceLabel).url,
            implementation_plan_name: planForProvince(provinceEn, provinceLabel).name,
            ...emptyAuctionFields(),
            is_demo: false,
            is_published: true,
          },
        ];
    if (!matches.length) rows.push(targets[0]);
    for (const target of targets) {
      if (coverageRatio != null) target.legacy_coverage_ratio = coverageRatio;
      if (strike != null) target.legacy_strike = strike;
      if (durationYears != null) target.legacy_duration_years = durationYears;
      if (legacyNote) target.legacy_note = legacyNote;
      if (legacyUrl) target.legacy_url = legacyUrl;
      legacyMerged += 1;
    }
  }
}

// EN first for numeric coverage/strike, then CN overwrites notes with Chinese text.
readLegacySheet(legacySheetEn, false);
readLegacySheet(legacySheetCn, true);

console.log(
  `Parsed ${rows.length} auction rows from results; merged terms into ${termsMerged}; legacy onto ${legacyMerged}; skipped ${skipped.length}`,
);
for (const line of skipped) console.log("  SKIP", line);

for (const row of rows) {
  row.pot_design = localizePotDesign(row.pot_design);
  row.commissioning_window = localizeCommissioningWindow(
    row.commissioning_window,
  );
  row.note = localizeCfdNote(row.note);
  row.source_name = localizeSourceName(row.source_name);
}

const { data: upserted, error: upsertError } = await supabase
  .from("china_cfd_auctions")
  .upsert(rows, { onConflict: "province_label,auction_round,delivery_year" })
  .select("id");
if (upsertError) {
  console.error("Upsert failed:", upsertError.message);
  process.exit(1);
}
console.log(`Upserted ${upserted.length} rows into china_cfd_auctions.`);
