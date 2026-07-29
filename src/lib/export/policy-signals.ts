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

export function isHighImpactPolicy(signal: Signal): boolean {
  if (/\(\*\*\*\)|\*\*\*/.test(signal.title || "")) return true;
  if (signal.impact_level === "high") return true;
  if (
    typeof signal.ai_importance === "number" &&
    signal.ai_importance >= 0.75
  ) {
    return true;
  }
  return false;
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

function renderEntry(row: PolicyExportRow): string[] {
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
  meta: { from: string; to: string; regionLabel: string },
): string {
  const range = `${meta.from || "不限"} – ${meta.to || "不限"}`;
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

  const domesticNational = rows.filter(
    (row) => row.section === "domestic_national",
  );
  const domesticRegional = rows.filter(
    (row) => row.section === "domestic_regional",
  );
  const overseas = rows.filter((row) => row.section === "overseas");

  if (domesticNational.length || domesticRegional.length) {
    lines.push(`## 国内相关政策`);
    lines.push("");
    if (domesticNational.length) {
      lines.push(`## ${SECTION_LABELS.domestic_national}`);
      lines.push("");
      for (const row of domesticNational) lines.push(...renderEntry(row));
    }
    if (domesticRegional.length) {
      lines.push(`## ${SECTION_LABELS.domestic_regional}`);
      lines.push("");
      for (const row of domesticRegional) lines.push(...renderEntry(row));
    }
  }

  if (overseas.length) {
    lines.push(`## ${SECTION_LABELS.overseas}`);
    lines.push("");
    const blocOrder: PolicyExportBloc[] = [
      "europe",
      "apac",
      "north-america",
      "latam",
      "other",
    ];
    for (const bloc of blocOrder) {
      const blocRows = overseas.filter((row) => row.overseas_bloc === bloc);
      if (!blocRows.length) continue;
      lines.push(`## ${BLOC_LABELS[bloc]}`);
      lines.push("");
      for (const row of blocRows) lines.push(...renderEntry(row));
    }
  }

  return lines.join("\n");
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
