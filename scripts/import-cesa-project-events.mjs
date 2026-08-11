// Import CESA storage tender / award / commissioning workbooks into
// public.bess_project_events (+ bess_award_candidates for awards).
//
// Usage:
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//   node scripts/import-cesa-project-events.mjs \
//     "/path/to/招标.xlsx" \
//     "/path/to/中标.xlsx" \
//     "/path/to/并网.xlsx"
//
// Re-running deletes rows for each source_batch then inserts fresh published
// rows. Unmapped / multi-province labels keep region_id null and
// province_label = 「未知」.

import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import ExcelJS from "exceljs";
import pg from "pg";

const workbookPaths = process.argv.slice(2);
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (!workbookPaths.length) {
  console.error(
    "Usage: node scripts/import-cesa-project-events.mjs <xlsx> [xlsx...]",
  );
  process.exit(1);
}

const SOURCE_NAME = "CESA储能应用分会";
const UNKNOWN_PROVINCE = "未知";

const PROVINCE_ALIASES = new Map([
  ["内蒙古自治区", "内蒙古"],
  ["内蒙古", "内蒙古"],
  ["蒙东", "内蒙古"],
  ["蒙西", "内蒙古"],
  ["广西壮族自治区", "广西"],
  ["广西", "广西"],
  ["西藏自治区", "西藏"],
  ["西藏", "西藏"],
  ["宁夏回族自治区", "宁夏"],
  ["宁夏", "宁夏"],
  ["新疆维吾尔自治区", "新疆"],
  ["新疆", "新疆"],
  ["北京市", "北京"],
  ["天津市", "天津"],
  ["上海市", "上海"],
  ["重庆市", "重庆"],
  ["香港", "香港"],
  ["香港特别行政区", "香港"],
  ["澳门", "澳门"],
  ["澳门特别行政区", "澳门"],
  ["台湾", "台湾"],
  ["台湾省", "台湾"],
]);

function cellValue(cell) {
  const value = cell?.value;
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if (value.richText) return value.richText.map((part) => part.text).join("");
    if (value.hyperlink && value.text != null) return value.text;
    if (value.hyperlink) return value.hyperlink;
    if (value.text != null) return value.text;
    if (value.result !== undefined) return value.result;
    return null;
  }
  return value;
}

function asText(raw) {
  if (raw == null) return null;
  const text = String(raw).replace(/\s+/g, " ").trim();
  if (!text || text === "——" || text === "—" || text === "-" || text === "/") {
    return null;
  }
  return text;
}

function asNumber(raw) {
  const text = asText(raw);
  if (text == null) return null;
  const value = Number(String(text).replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function asDate(raw) {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "number" && raw > 20000 && raw < 80000) {
    // Excel serial date (1900 date system).
    const utc = Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000;
    return new Date(utc).toISOString().slice(0, 10);
  }
  const text = asText(raw);
  if (!text) return null;
  const match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }
  return null;
}

function rowHash(parts) {
  return createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex");
}

function normalizeProvinceLabel(raw) {
  const text = asText(raw);
  if (!text) return null;
  if (PROVINCE_ALIASES.has(text)) return PROVINCE_ALIASES.get(text);
  const stripped = text
    .replace(/(维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|省|市)$/u, "")
    .trim();
  if (PROVINCE_ALIASES.has(stripped)) return PROVINCE_ALIASES.get(stripped);
  return stripped || null;
}

function resolveProvince(raw, provincesByName) {
  const label = normalizeProvinceLabel(raw);
  if (!label) {
    return { region_id: null, province_label: UNKNOWN_PROVINCE, province_raw: asText(raw) };
  }
  // Multi-province / frame-procurement strings stay unknown.
  if (/[、,，/]|等省|集采|框采|委托|代工|蒙东\(|蒙西\(/u.test(String(raw))) {
    return { region_id: null, province_label: UNKNOWN_PROVINCE, province_raw: asText(raw) };
  }
  const region = provincesByName.get(label);
  if (!region) {
    return { region_id: null, province_label: UNKNOWN_PROVINCE, province_raw: asText(raw) };
  }
  return {
    region_id: region.id,
    province_label: region.name_zh,
    province_raw: asText(raw),
  };
}

function headerMap(row) {
  const map = new Map();
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const key = asText(cellValue(cell));
    if (key) map.set(key, col);
  });
  return map;
}

function pick(row, map, names) {
  for (const name of names) {
    const col = map.get(name);
    if (col == null) continue;
    const value = cellValue(row.getCell(col));
    if (value != null && String(value).trim() !== "") return value;
  }
  return null;
}

function detectKind(fileName, sheetName) {
  const blob = `${fileName} ${sheetName}`;
  if (/中标|候选人/u.test(blob)) return "award";
  if (/并网/u.test(blob)) return "commissioning";
  if (/招标/u.test(blob)) return "tender";
  return null;
}

function isPrimaryRank(label) {
  const text = asText(label) || "";
  return (
    text.includes("第1") ||
    text.includes("第一") ||
    text === "中标人" ||
    text === "中标候选人"
  );
}

function rankOrder(label) {
  const text = asText(label) || "";
  const match = text.match(/第\s*(\d+)\s*/u) || text.match(/第([一二三四五六七八九十]+)备?选?/u);
  if (match?.[1]) {
    const map = {
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    };
    if (map[match[1]]) return map[match[1]];
    const n = Number(match[1]);
    if (Number.isFinite(n)) return n;
  }
  if (text.includes("中标人") && !text.includes("候选")) return 0;
  if (text === "中标候选人") return 1;
  return null;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function parseWorkbook(filePath, provincesByName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const fileName = path.basename(filePath);
  const sourceBatch = path.basename(filePath, path.extname(filePath));

  let best = null;
  for (const sheet of workbook.worksheets) {
    if (!sheet || sheet.rowCount < 3) continue;
    const kind = detectKind(fileName, sheet.name);
    if (!kind) continue;
    const score = sheet.actualRowCount || sheet.rowCount;
    if (!best || score > best.score) best = { sheet, kind, score };
  }
  if (!best) {
    throw new Error(`No usable sheet in ${fileName}`);
  }

  const { sheet, kind } = best;
  let headerRowNumber = null;
  let columns = null;
  for (let r = 1; r <= Math.min(8, sheet.rowCount); r += 1) {
    const map = headerMap(sheet.getRow(r));
    if ([...map.keys()].some((key) => key.includes("项目名称"))) {
      headerRowNumber = r;
      columns = map;
      break;
    }
  }
  if (!headerRowNumber || !columns) {
    throw new Error(`Header not found in ${fileName} / ${sheet.name}`);
  }

  const events = [];
  const candidatesByTempId = new Map();
  let currentAward = null;

  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const seq = asText(pick(row, columns, ["序号"]));
    const title = asText(pick(row, columns, ["项目名称"]));
    const rankLabel = asText(
      pick(row, columns, ["中标候选人排序", "候选人排序"]),
    );
    const candidateName = asText(
      pick(row, columns, ["中标候选人", "候选人", "中标人"]),
    );
    const order = rankOrder(rankLabel);
    // Merged title/序号 cells make continuation rows look like full projects.
    // Secondary ranks are the reliable signal for award continuations.
    const looksLikeSecondary =
      (order != null && order > 1) ||
      /第\s*(?:[2-9]|1[0-9]|二|三|四|五|六|七|八|九|十)|备选|入围/u.test(
        rankLabel || "",
      );

    if (kind === "award" && currentAward && looksLikeSecondary) {
      if (!candidateName) continue;
      const list = candidatesByTempId.get(currentAward.tempId) ?? [];
      list.push({
        rank_label: rankLabel || "候选人",
        rank_order: order,
        candidate_name: candidateName,
        candidate_group: asText(
          pick(row, columns, ["中标候选人简称/所属集团", "所属集团"]),
        ),
        bid_amount_wan: asNumber(pick(row, columns, ["投标报价（万元）"])),
        unit_price_yuan_per_wh: asNumber(pick(row, columns, ["单价（元/Wh）"])),
        is_primary: false,
      });
      candidatesByTempId.set(currentAward.tempId, list);
      continue;
    }

    if (!title) continue;

    const provinceRaw = pick(row, columns, [
      "省/直辖市/自治区",
      "省份/直辖市/自治区",
      "建设地点",
      "省",
    ]);
    const province = resolveProvince(provinceRaw, provincesByName);
    const eventDate =
      asDate(
        pick(row, columns, [
          "招标公示时间",
          "中标候选人公示时间",
          "并网时间/公布时间",
          "并网时间",
        ]),
      ) || "1970-01-01";

    const id = randomUUID();
    const tempId = id;
    const event = {
      id,
      tempId,
      event_type: kind,
      title,
      event_date: eventDate,
      region_id: province.region_id,
      province_label: province.province_label,
      province_raw: province.province_raw,
      city_raw: asText(pick(row, columns, ["市"])),
      region_bloc: asText(pick(row, columns, ["地区"])),
      power_mw: asNumber(pick(row, columns, ["功率（MW）"])),
      energy_mwh: asNumber(pick(row, columns, ["容量（MWh）"])),
      duration_h: asNumber(pick(row, columns, ["时长（h）", "时长", "储能时长"])),
      duration_band: asText(
        pick(row, columns, ["时长区间（h）", "储能时长区间"]),
      ),
      scale_label: asText(pick(row, columns, ["储能规模"])),
      c_rate: asNumber(pick(row, columns, ["倍率C", "倍率"])),
      scene: asText(pick(row, columns, ["应用场景"])),
      plant_type: asText(pick(row, columns, ["电站类型"])),
      technology: asText(pick(row, columns, ["储能技术"])),
      owner_name: asText(pick(row, columns, ["招标人", "项目业主"])),
      owner_group: asText(
        pick(row, columns, ["顶层集团/简称", "企业简称/顶层集团"]),
      ),
      counterparty_name: asText(
        pick(row, columns, ["EPC总承包/承建方", "系统供应商简称"]),
      ),
      scope_label: asText(pick(row, columns, ["招标内容", "中标内容"])),
      status_label: asText(pick(row, columns, ["项目进展"])),
      summary: (() => {
        const text = asText(pick(row, columns, ["项目概况"]));
        return text && text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
      })(),
      budget_wan: asNumber(
        pick(row, columns, [
          "总投资/最高限价/预算 （万元）",
          "总投资/最高限价/预算（万元） （万元）",
          "投资（万元）",
        ]),
      ),
      unit_price_cap_yuan_per_wh: asNumber(
        pick(row, columns, ["招标控制单价（元/Wh)", "招标控制单价（元/Wh）"]),
      ),
      result_date: asDate(pick(row, columns, ["中标结果公示时间"])),
      source_name: SOURCE_NAME,
      source_batch: sourceBatch,
      source_row_hash: rowHash([
        kind,
        sourceBatch,
        `row:${r}`,
        String(seq || ""),
        title,
        eventDate,
        asText(provinceRaw),
      ]),
      raw: {
        sheet: sheet.name,
        row: r,
        file: fileName,
        seq,
      },
      is_demo: false,
      is_published: true,
    };

    events.push(event);
    if (kind === "award") {
      currentAward = event;
      const list = [];
      if (candidateName) {
        list.push({
          rank_label: rankLabel || "第1中标候选人",
          rank_order: rankOrder(rankLabel) ?? 1,
          candidate_name: candidateName,
          candidate_group: asText(
            pick(row, columns, ["中标候选人简称/所属集团", "所属集团"]),
          ),
          bid_amount_wan: asNumber(pick(row, columns, ["投标报价（万元）"])),
          unit_price_yuan_per_wh: asNumber(pick(row, columns, ["单价（元/Wh）"])),
          is_primary: rankLabel ? isPrimaryRank(rankLabel) : true,
        });
      }
      candidatesByTempId.set(tempId, list);
    } else {
      currentAward = null;
    }
  }

  return { sourceBatch, kind, events, candidatesByTempId, sheetName: sheet.name };
}

async function main() {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const regionResult = await pool.query(
      `select id, name_zh from public.regions where region_type = 'province'`,
    );
    const provincesByName = new Map(
      regionResult.rows.map((region) => [region.name_zh, region]),
    );

    for (const filePath of workbookPaths) {
      console.log(`\nParsing ${filePath}`);
      const parsed = await parseWorkbook(filePath, provincesByName);
      console.log(
        `  sheet=${parsed.sheetName} type=${parsed.kind} events=${parsed.events.length}`,
      );

      await pool.query(
        `delete from public.bess_project_events where source_batch = $1`,
        [parsed.sourceBatch],
      );

      let inserted = 0;
      let candidatesInserted = 0;
      for (const group of chunk(parsed.events, 100)) {
        const client = await pool.connect();
        try {
          await client.query("begin");
          for (const event of group) {
            const { tempId: _tempId, ...row } = event;
            await client.query(
              `insert into public.bess_project_events (
                id, event_type, title, event_date, region_id, province_label, province_raw,
                city_raw, region_bloc, power_mw, energy_mwh, duration_h, duration_band,
                scale_label, c_rate, scene, plant_type, technology, owner_name, owner_group,
                counterparty_name, scope_label, status_label, summary, budget_wan,
                unit_price_cap_yuan_per_wh, result_date, source_name, source_batch,
                source_row_hash, raw, is_demo, is_published
              ) values (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31::jsonb,$32,$33
              )`,
              [
                row.id,
                row.event_type,
                row.title,
                row.event_date,
                row.region_id,
                row.province_label,
                row.province_raw,
                row.city_raw,
                row.region_bloc,
                row.power_mw,
                row.energy_mwh,
                row.duration_h,
                row.duration_band,
                row.scale_label,
                row.c_rate,
                row.scene,
                row.plant_type,
                row.technology,
                row.owner_name,
                row.owner_group,
                row.counterparty_name,
                row.scope_label,
                row.status_label,
                row.summary,
                row.budget_wan,
                row.unit_price_cap_yuan_per_wh,
                row.result_date,
                row.source_name,
                row.source_batch,
                row.source_row_hash,
                JSON.stringify(row.raw ?? {}),
                row.is_demo,
                row.is_published,
              ],
            );
            inserted += 1;

            const candidates = parsed.candidatesByTempId.get(event.tempId) ?? [];
            for (const candidate of candidates) {
              await client.query(
                `insert into public.bess_award_candidates (
                  event_id, rank_label, rank_order, candidate_name, candidate_group,
                  bid_amount_wan, unit_price_yuan_per_wh, is_primary
                ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [
                  event.id,
                  candidate.rank_label,
                  candidate.rank_order,
                  candidate.candidate_name,
                  candidate.candidate_group,
                  candidate.bid_amount_wan,
                  candidate.unit_price_yuan_per_wh,
                  candidate.is_primary,
                ],
              );
              candidatesInserted += 1;
            }
          }
          await client.query("commit");
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
      }

      const unknown = parsed.events.filter(
        (event) => event.province_label === UNKNOWN_PROVINCE,
      ).length;
      console.log(
        `  inserted events=${inserted} candidates=${candidatesInserted} unknown_province=${unknown}`,
      );
    }

    console.log("\nDone.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
