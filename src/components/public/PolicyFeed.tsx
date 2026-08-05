"use client";

import { useMemo, useState } from "react";

import {
  buildPolicyExportRows,
  downloadTextFile,
  isHighImpactPolicy,
  policyRowsToCsv,
  policyRowsToWordHtml,
} from "@/lib/export/policy-signals";
import { POLICY_INGEST_AUTO_PUBLISH_MIN } from "@/lib/policy-ingest/config";
import {
  isPublishedPolicySignal,
  listRegionPolicyArchive,
  policySignalDate,
} from "@/lib/policy/region-archive";
import { compareContinents, compareCountries } from "@/lib/region-order";
import { descendantRegionIds } from "@/lib/regions/descendant-ids";
import type { Region, Signal } from "@/lib/types";

import {
  formatDate,
  normalizedStatusLabel,
  statusClassName,
} from "./formatters";
import { HighImpactMark, stripLegacyImpactPrefix } from "./HighImpactMark";
import styles from "./PolicyFeed.module.css";

type SignalHref = (signal: Signal) => string;

const BESS_FOCUS_COUNTRY_SLUGS = new Set([
  "china",
  "india",
  "malaysia",
  "indonesia",
  "australia",
  "japan",
  "south-korea",
  "united-kingdom",
  "usa",
  "canada",
  "mexico",
  "brazil",
  "chile",
  "germany",
  "france",
  "spain",
  "italy",
  "netherlands",
]);

const MACRO_TABS = [
  { key: "", label: "全球" },
  { key: "macro:china", label: "中国" },
  { key: "macro:apac", label: "亚太" },
  { key: "macro:west", label: "欧美" },
  { key: "macro:latam", label: "拉美" },
] as const;

const MACRO_CONTINENT_SLUGS: Record<string, string[]> = {
  "macro:apac": ["asia", "oceania"],
  "macro:west": ["europe", "north-america"],
  "macro:latam": ["south-america"],
};

const INITIAL_VISIBLE = 8;

function regionLabel(region: Region | undefined): string {
  return region?.name_zh || region?.name_en || region?.code || "未命名地区";
}

function inDateRange(date: string, from: string, to: string): boolean {
  if (!date) return !from && !to;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function defaultSignalHref(signal: Signal): string {
  return `/signals/${signal.id}`;
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveScopeIds(
  regions: readonly Region[],
  filter: string,
): Set<string> | null {
  if (!filter) return null;

  if (filter === "macro:china") {
    const china = regions.find(
      (region) =>
        region.region_type === "country" && region.slug === "china",
    );
    return china ? descendantRegionIds(regions, china.id) : new Set();
  }

  const continentSlugs = MACRO_CONTINENT_SLUGS[filter];
  if (continentSlugs) {
    const ids = new Set<string>();
    for (const slug of continentSlugs) {
      const continent = regions.find(
        (region) =>
          region.region_type === "continent" && region.slug === slug,
      );
      if (!continent) continue;
      for (const id of descendantRegionIds(regions, continent.id)) {
        ids.add(id);
      }
    }
    return ids;
  }

  return descendantRegionIds(regions, filter);
}

export function PolicyFeed({
  signals,
  regions,
  getSignalHref = defaultSignalHref,
  initialRegionId = "",
  variant = "global",
  archiveRegion = null,
}: {
  signals: readonly Signal[];
  regions: readonly Region[];
  getSignalHref?: SignalHref;
  initialRegionId?: string;
  /** global = cross-region desk; region-archive = locked regional feed */
  variant?: "global" | "region-archive";
  archiveRegion?: Region | null;
}) {
  const isArchive = variant === "region-archive" && Boolean(archiveRegion);
  const [regionFilter, setRegionFilter] = useState(
    isArchive ? archiveRegion!.id : initialRegionId,
  );
  const [fromDate, setFromDate] = useState(() =>
    isArchive ? daysAgoIso(365) : daysAgoIso(45),
  );
  const [toDate, setToDate] = useState(todayIso);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const regionsById = useMemo(
    () => new Map(regions.map((region) => [region.id, region])),
    [regions],
  );

  const continentOptions = useMemo(
    () =>
      regions
        .filter((region) => region.region_type === "continent")
        .sort(compareContinents),
    [regions],
  );

  const countryOptions = useMemo(() => {
    const focus = regions
      .filter(
        (region) =>
          region.region_type === "country" &&
          BESS_FOCUS_COUNTRY_SLUGS.has(region.slug),
      )
      .sort(compareCountries);
    if (focus.length) return focus;
    return regions
      .filter((region) => region.region_type === "country")
      .sort(compareCountries);
  }, [regions]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    const base = isArchive
      ? listRegionPolicyArchive(signals, regions, archiveRegion!.id)
      : signals
          .filter(isPublishedPolicySignal)
          .filter((signal) => {
            const scopeIds = resolveScopeIds(regions, regionFilter);
            return !scopeIds || scopeIds.has(signal.region_id);
          })
          .sort((left, right) =>
            policySignalDate(right).localeCompare(policySignalDate(left)),
          );

    return base
      .filter((signal) =>
        inDateRange(policySignalDate(signal), fromDate, toDate),
      )
      .filter((signal) => {
        if (!normalizedQuery) return true;
        const region = regionsById.get(signal.region_id);
        const haystack = [
          signal.title,
          signal.summary,
          signal.category,
          signal.source_name,
          region?.name_zh,
          region?.name_en,
          region?.code,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("zh-CN");
        return haystack.includes(normalizedQuery);
      });
  }, [
    signals,
    regions,
    regionFilter,
    fromDate,
    toDate,
    query,
    regionsById,
    isArchive,
    archiveRegion,
  ]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const archiveLabel = archiveRegion
    ? regionLabel(archiveRegion)
    : "当前区域";

  const regionFilterLabel = isArchive
    ? archiveLabel
    : (() => {
        const macro = MACRO_TABS.find((tab) => tab.key === regionFilter);
        if (macro && macro.key) return macro.label;
        if (!regionFilter) return "全球（全部）";
        return regionLabel(regionsById.get(regionFilter));
      })();

  const realCount = filtered.filter((signal) => !signal.is_demo).length;
  const demoCount = filtered.length - realCount;

  function setMacroOrRegion(next: string) {
    if (isArchive) return;
    setRegionFilter(next);
    setVisibleCount(INITIAL_VISIBLE);
  }

  function exportRows() {
    return buildPolicyExportRows(filtered, regionsById);
  }

  function exportMeta() {
    return {
      from: fromDate,
      to: toDate,
      regionLabel: regionFilterLabel,
    };
  }

  function exportWord() {
    const html = policyRowsToWordHtml(exportRows(), exportMeta());
    downloadTextFile(
      `policy-brief_${fromDate || "all"}_${toDate || "all"}.doc`,
      html,
      "application/msword;charset=utf-8",
    );
  }

  function exportCsv() {
    downloadTextFile(
      `policy-brief_${fromDate || "all"}_${toDate || "all"}.csv`,
      policyRowsToCsv(exportRows()),
      "text/csv;charset=utf-8",
    );
  }

  const titleId = isArchive ? "region-policy-title" : "policy-feed-title";

  return (
    <section className={styles.feed} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            {isArchive ? "Region policy archive" : "Policy intelligence"}
          </span>
          <h2 id={titleId}>
            {isArchive ? `${archiveLabel}政策信息流` : "政策动态"}
          </h2>
          {isArchive ? null : (
            <p className={styles.legend}>
              <span
                className={styles.legendTip}
                tabIndex={0}
                aria-describedby="policy-key-rule"
              >
                <HighImpactMark className={styles.impactInline} withLabel />
                <span
                  id="policy-key-rule"
                  className={styles.legendTipBubble}
                  role="tooltip"
                >
                  系统自动判定：AI 星标且重要性 ≥{" "}
                  {POLICY_INGEST_AUTO_PUBLISH_MIN}
                  。通常对应直接影响储能商业模式、强制要求、市场准入或重大市场机会。
                </span>
              </span>
              <span>标示重要政策，由系统自动判定。</span>
            </p>
          )}
        </div>
        <div className={styles.count}>
          {String(realCount).padStart(2, "0")} REAL
          {demoCount ? ` · ${String(demoCount).padStart(2, "0")} DEMO` : ""}
        </div>
      </header>

      {isArchive ? null : (
        <div className={styles.tabs} role="tablist" aria-label="政策区域">
          {MACRO_TABS.map((tab) => (
            <button
              key={tab.key || "all"}
              type="button"
              role="tab"
              aria-selected={regionFilter === tab.key}
              className={
                regionFilter === tab.key ? styles.tabActive : styles.tab
              }
              onClick={() => setMacroOrRegion(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div
        className={
          isArchive ? styles.toolbarArchive : styles.toolbar
        }
      >
        {isArchive ? null : (
          <label>
            <span>区域细筛</span>
            <select
              value={
                regionFilter.startsWith("macro:") || regionFilter === ""
                  ? ""
                  : regionFilter
              }
              onChange={(event) => setMacroOrRegion(event.target.value)}
            >
              <option value="">（使用上方分区 Tab）</option>
              {continentOptions.length ? (
                <optgroup label="大洲">
                  {continentOptions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {regionLabel(region)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {countryOptions.length ? (
                <optgroup label="BESS 重点国家">
                  {countryOptions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {regionLabel(region)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
        )}
        <label>
          <span>开始日期</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setVisibleCount(INITIAL_VISIBLE);
            }}
          />
        </label>
        <label>
          <span>结束日期</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setVisibleCount(INITIAL_VISIBLE);
            }}
          />
        </label>
        <label className={styles.search}>
          <span>关键词</span>
          <input
            type="search"
            value={query}
            placeholder="标题 / 摘要 / 来源"
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(INITIAL_VISIBLE);
            }}
          />
        </label>
        <div className={styles.exportActions}>
          <button type="button" onClick={exportWord}>
            导出 Word
          </button>
          <button type="button" onClick={exportCsv}>
            导出 CSV
          </button>
        </div>
      </div>

      {filtered.length ? (
        <>
          <ul className={styles.list}>
            {visible.map((signal) => {
              const region = regionsById.get(signal.region_id);
              return (
                <li key={signal.id}>
                  <a className={styles.item} href={getSignalHref(signal)}>
                    <div className={styles.meta}>
                      <time>{formatDate(policySignalDate(signal))}</time>
                      <strong>{regionLabel(region)}</strong>
                    </div>
                    <div className={styles.body}>
                      <div className={styles.pills}>
                        {isHighImpactPolicy(signal) ? (
                          <HighImpactMark className={styles.impact} withLabel />
                        ) : null}
                        <span
                          className={`gl-status-pill ${statusClassName(signal.normalized_status)}`}
                          data-status={signal.normalized_status || "other"}
                        >
                          {normalizedStatusLabel(signal.normalized_status)}
                        </span>
                        {signal.is_demo ? (
                          <span className={styles.demo}>Demo</span>
                        ) : null}
                      </div>
                      <h3>{stripLegacyImpactPrefix(signal.title)}</h3>
                      <p>{signal.summary}</p>
                      <div className={styles.tags}>
                        {signal.category ? (
                          <span>#{signal.category}</span>
                        ) : null}
                        {signal.policy_track === "storage_power_market" ? (
                          <span>#储能电力市场</span>
                        ) : signal.policy_track === "esg" ? (
                          <span>#ESG</span>
                        ) : signal.policy_track === "both" ? (
                          <span>#双轨</span>
                        ) : null}
                        {signal.source_name ? (
                          <span>#{signal.source_name}</span>
                        ) : null}
                      </div>
                    </div>
                    <span className={styles.arrow} aria-hidden="true">
                      →
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
          {hasMore ? (
            <div className={styles.more}>
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((count) => count + INITIAL_VISIBLE)
                }
              >
                查看更多（还剩 {filtered.length - visibleCount} 条）
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className={styles.empty}>
          {isArchive
            ? `「${archiveLabel}」暂无已发布政策归档。后台将 policy 发布到本区或其下级地区后，会自动出现在此信息流。`
            : `当前筛选范围内暂无已发布政策。可放宽日期或区域，或在后台发布 policy 记录后刷新。`}
        </div>
      )}
    </section>
  );
}
