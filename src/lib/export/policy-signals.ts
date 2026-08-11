import { POLICY_INGEST_AUTO_PUBLISH_MIN } from "@/lib/policy-ingest/config";
import type { Region, Signal } from "@/lib/types";

export type PolicyExportSection =
  | "domestic_national"
  | "domestic_regional"
  | "overseas";

export type PolicyExportBloc =
  | "europe"
  | "apac"
  | "north-america"
  | "latam"
  | "other";

export type PolicyExportRow = {
  event_date: string;
  region: string;
  region_slug: string;
  title: string;
  summary: string;
  normalized_status: string;
  category: string;
  source_name: string;
  source_url: string;
  published_at: string;
  /** Matches monthly report（***）importance marker. */
  importance_mark: "***" | "";
  section: PolicyExportSection;
  overseas_bloc: PolicyExportBloc | "";
};

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function isChinaTree(
  region: Region | undefined,
  regionsById: Map<string, Region>,
): boolean {
  let current = region;
  while (current) {
    if (current.slug === "china" || current.code === "CN") return true;
    current = current.parent_id
      ? regionsById.get(current.parent_id)
      : undefined;
  }
  return false;
}

function continentSlugOf(
  region: Region | undefined,
  regionsById: Map<string, Region>,
): string {
  let current = region;
  while (current) {
    if (current.region_type === "continent") return current.slug;
    current = current.parent_id
      ? regionsById.get(current.parent_id)
      : undefined;
  }
  return "";
}

function overseasBloc(
  continentSlug: string,
  countrySlug: string,
): PolicyExportBloc {
  if (
    continentSlug === "europe" ||
    countrySlug === "united-kingdom" ||
    countrySlug === "germany" ||
    countrySlug === "france" ||
    countrySlug === "spain" ||
    countrySlug === "italy" ||
    countrySlug === "netherlands"
  ) {
    return "europe";
  }
  if (
    continentSlug === "asia" ||
    continentSlug === "oceania" ||
    continentSlug === "africa"
  ) {
    return "apac";
  }
  if (continentSlug === "north-america") return "north-america";
  if (continentSlug === "south-america") return "latam";
  return "other";
}

/** Public Key / high-impact marker — same threshold as AI auto-publish. */
export function isHighImpactPolicy(signal: Signal): boolean {
  if (signal.star_mark) return true;
  if (/\(\*\*\*\)|\*\*\*/.test(signal.title || "")) return true;
  if (signal.impact_level === "high") return true;
  return (
    typeof signal.ai_importance === "number" &&
    signal.ai_importance >= POLICY_INGEST_AUTO_PUBLISH_MIN
  );
}

export function buildPolicyExportRows(
  signals: readonly Signal[],
  regionsById: Map<string, Region>,
): PolicyExportRow[] {
  return signals.map((signal) => {
    const region = signal.region_id
      ? regionsById.get(signal.region_id)
      : undefined;
    const china = isChinaTree(region, regionsById);
    const continentSlug = continentSlugOf(region, regionsById);
    const countrySlug =
      region?.region_type === "country"
        ? region.slug
        : region?.region_type === "province"
          ? regionsById.get(region.parent_id || "")?.slug || ""
          : region?.slug || "";

    let section: PolicyExportSection = "overseas";
    if (china) {
      section =
        region?.region_type === "province"
          ? "domestic_regional"
          : region?.slug === "china"
            ? "domestic_national"
            : "domestic_regional";
    }

    return {
      event_date: signal.event_date || signal.published_at?.slice(0, 10) || "",
      region: region?.name_zh || region?.name_en || region?.code || "",
      region_slug: region?.slug || "",
      title: signal.title?.trim() || "",
      summary: signal.summary?.trim() || "",
      normalized_status: signal.normalized_status || "",
      category: signal.category || "",
      source_name: signal.source_name || "",
      source_url: signal.source_url || "",
      published_at: signal.published_at?.slice(0, 10) || "",
      importance_mark: isHighImpactPolicy(signal) ? "***" : "",
      section,
      overseas_bloc: china
        ? ""
        : overseasBloc(continentSlug, countrySlug),
    };
  });
}

export function policyRowsToCsv(rows: readonly PolicyExportRow[]): string {
  const headers = [
    "event_date",
    "region",
    "title",
    "importance_mark",
    "section",
    "overseas_bloc",
    "summary",
    "normalized_status",
    "category",
    "source_name",
    "source_url",
    "published_at",
  ] as const;
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((key) => csvEscape(String(row[key] ?? ""))).join(","),
    ),
  ];
  return `\uFEFF${lines.join("\n")}\n`;
}

const SECTION_LABELS: Record<PolicyExportSection, string> = {
  domestic_national: "国家政策",
  domestic_regional: "区域政策",
  overseas: "海外相关政策",
};

const BLOC_LABELS: Record<PolicyExportBloc, string> = {
  europe: "欧洲",
  apac: "亚太",
  "north-america": "北美",
  latam: "拉美",
  other: "其他",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type BriefMeta = { from: string; to: string; regionLabel: string };

type BriefSections = {
  range: string;
  domesticNational: PolicyExportRow[];
  domesticRegional: PolicyExportRow[];
  overseasByBloc: Array<{ bloc: PolicyExportBloc; rows: PolicyExportRow[] }>;
};

const OVERSEAS_BLOC_ORDER: PolicyExportBloc[] = [
  "europe",
  "apac",
  "north-america",
  "latam",
  "other",
];

function groupBriefSections(
  rows: readonly PolicyExportRow[],
  meta: BriefMeta,
): BriefSections {
  const overseas = rows.filter((row) => row.section === "overseas");
  return {
    range: `${meta.from || "不限"} – ${meta.to || "不限"}`,
    domesticNational: rows.filter((row) => row.section === "domestic_national"),
    domesticRegional: rows.filter((row) => row.section === "domestic_regional"),
    overseasByBloc: OVERSEAS_BLOC_ORDER.map((bloc) => ({
      bloc,
      rows: overseas.filter((row) => row.overseas_bloc === bloc),
    })).filter((group) => group.rows.length > 0),
  };
}

function renderMarkdownEntry(row: PolicyExportRow): string[] {
  const mark = row.importance_mark ? `（***）` : "";
  const lines = [
    `### ${mark}${row.title}`,
    ``,
    `${row.event_date || "—"}${row.region ? ` · ${row.region}` : ""}`,
    ``,
    row.summary || "—",
    ``,
  ];
  if (row.source_url) {
    const label = row.source_name || "原文链接";
    lines.push(`[${label}](${row.source_url})`);
    lines.push("");
  }
  return lines;
}

/**
 * Markdown shape aligned with Jinko ESS 储能与 ESG 政策月报：
 * 说明 → 国内（国家/区域）→ 海外（欧/亚太/北美/拉美）
 * 中文正文；（***）标重要影响；不自动生成英文翻译。
 */
export function policyRowsToMarkdown(
  rows: readonly PolicyExportRow[],
  meta: BriefMeta,
): string {
  const { range, domesticNational, domesticRegional, overseasByBloc } =
    groupBriefSections(rows, meta);
  const lines = [
    `# 储能与 ESG 政策动态（${range}）`,
    ``,
    ` 对晶科储能可能存在重要影响的政策，以（***）标出；不收录纯鼓励类、重要性较低或无显著影响条目。`,
    ` 中国相关政策仅保留中文。`,
    ` 导出范围：${meta.regionLabel} · 共 ${rows.length} 条`,
    ``,
  ];

  if (!rows.length) {
    lines.push("_该范围内暂无已发布政策记录。_");
    lines.push("");
    return lines.join("\n");
  }

  if (domesticNational.length || domesticRegional.length) {
    lines.push(`## 国内相关政策`);
    lines.push("");
    if (domesticNational.length) {
      lines.push(`## ${SECTION_LABELS.domestic_national}`);
      lines.push("");
      for (const row of domesticNational) {
        lines.push(...renderMarkdownEntry(row));
      }
    }
    if (domesticRegional.length) {
      lines.push(`## ${SECTION_LABELS.domestic_regional}`);
      lines.push("");
      for (const row of domesticRegional) {
        lines.push(...renderMarkdownEntry(row));
      }
    }
  }

  if (overseasByBloc.length) {
    lines.push(`## ${SECTION_LABELS.overseas}`);
    lines.push("");
    for (const group of overseasByBloc) {
      lines.push(`## ${BLOC_LABELS[group.bloc]}`);
      lines.push("");
      for (const row of group.rows) lines.push(...renderMarkdownEntry(row));
    }
  }

  return lines.join("\n");
}

function renderWordEntry(row: PolicyExportRow): string {
  const mark = row.importance_mark ? "（***）" : "";
  const metaLine = `${row.event_date || "—"}${
    row.region ? ` · ${row.region}` : ""
  }`;
  const source = row.source_url
    ? `<p><a href="${escapeHtml(row.source_url)}">${escapeHtml(
        row.source_name || "原文链接",
      )}</a></p>`
    : "";
  return [
    `<h3>${escapeHtml(mark + row.title)}</h3>`,
    `<p><strong>${escapeHtml(metaLine)}</strong></p>`,
    `<p>${escapeHtml(row.summary || "—").replace(/\n/g, "<br>")}</p>`,
    source,
  ].join("\n");
}

/**
 * Word-compatible HTML (.doc). Opens in Microsoft Word / WPS with the same
 * monthly-report sectioning as the Markdown export.
 */
export function policyRowsToWordHtml(
  rows: readonly PolicyExportRow[],
  meta: BriefMeta,
): string {
  const { range, domesticNational, domesticRegional, overseasByBloc } =
    groupBriefSections(rows, meta);
  const parts: string[] = [
    `<h1>储能与 ESG 政策动态（${escapeHtml(range)}）</h1>`,
    `<p> 对晶科储能可能存在重要影响的政策，以（***）标出；不收录纯鼓励类、重要性较低或无显著影响条目。</p>`,
    `<p> 中国相关政策仅保留中文。</p>`,
    `<p> 导出范围：${escapeHtml(meta.regionLabel)} · 共 ${rows.length} 条</p>`,
  ];

  if (!rows.length) {
    parts.push("<p><em>该范围内暂无已发布政策记录。</em></p>");
  } else {
    if (domesticNational.length || domesticRegional.length) {
      parts.push("<h2>国内相关政策</h2>");
      if (domesticNational.length) {
        parts.push(`<h2>${SECTION_LABELS.domestic_national}</h2>`);
        for (const row of domesticNational) parts.push(renderWordEntry(row));
      }
      if (domesticRegional.length) {
        parts.push(`<h2>${SECTION_LABELS.domestic_regional}</h2>`);
        for (const row of domesticRegional) parts.push(renderWordEntry(row));
      }
    }
    if (overseasByBloc.length) {
      parts.push(`<h2>${SECTION_LABELS.overseas}</h2>`);
      for (const group of overseasByBloc) {
        parts.push(`<h2>${BLOC_LABELS[group.bloc]}</h2>`);
        for (const row of group.rows) parts.push(renderWordEntry(row));
      }
    }
  }

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word"
 xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>储能与 ESG 政策动态</title>
<!--[if gte mso 9]><xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
 </w:WordDocument>
</xml><![endif]-->
<style>
  body {
    font-family: "Songti SC", "SimSun", "Microsoft YaHei", serif;
    font-size: 12pt;
    line-height: 1.65;
    color: #111;
  }
  h1 { font-size: 18pt; font-weight: 700; margin: 0 0 16pt; }
  h2 { font-size: 14pt; font-weight: 700; margin: 18pt 0 8pt; }
  h3 { font-size: 12pt; font-weight: 700; margin: 14pt 0 6pt; }
  p { margin: 0 0 8pt; }
  a { color: #006633; }
</style>
</head>
<body>
${parts.join("\n")}
</body>
</html>
`;
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
