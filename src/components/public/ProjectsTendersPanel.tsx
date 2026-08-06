"use client";

import { useEffect, useMemo, useState } from "react";

import type { BessProjectAnalytics } from "@/lib/bess-projects/analytics";
import {
  ANALYTICS_YEAR_OPTIONS,
  DEFAULT_ANALYTICS_YEAR,
  formatPeriodLabel,
  MONTH_OPTIONS,
  resolvePeriodRange,
  type PeriodMode,
  yearBounds,
} from "@/lib/bess-projects/period";
import type {
  BessProjectEvent,
  BessProjectEventType,
  Region,
} from "@/lib/types";
import { ProjectsAnalyticsCharts } from "./ProjectsAnalyticsCharts";
import { formatDate, formatNullableNumber } from "./formatters";

const TRACKS: Array<{
  id: BessProjectEventType | "all";
  label: string;
}> = [
  { id: "all", label: "全部" },
  { id: "tender", label: "招标" },
  { id: "award", label: "中标" },
  { id: "commissioning", label: "并网" },
];

const TRACK_LABEL: Record<BessProjectEventType, string> = {
  tender: "招标",
  award: "中标",
  commissioning: "并网",
};

const SCENE_OPTIONS = ["用户侧", "电网侧", "电源侧", "集采/框采"];
const PLANT_OPTIONS = [
  "独立储能",
  "工商业储能",
  "光储充",
  "光伏配储",
  "风电配储",
  "分布式光伏配储",
  "光储EPC",
];

const PAGE_SIZE = 15;

type PagePayload = {
  items: BessProjectEvent[];
  total: number;
  page: number;
  page_size: number;
  counts: {
    all: number;
    tender: number;
    award: number;
    commissioning: number;
  };
  sources: string[];
};

function scaleText(event: BessProjectEvent): string {
  if (event.scale_label) return event.scale_label;
  const power = formatNullableNumber(event.power_mw);
  const energy = formatNullableNumber(event.energy_mwh);
  if (power === "—" && energy === "—") return "—";
  if (power !== "—" && energy !== "—") return `${power} MW / ${energy} MWh`;
  if (power !== "—") return `${power} MW`;
  return `${energy} MWh`;
}

function primaryCandidate(event: BessProjectEvent) {
  const candidates = event.candidates ?? [];
  return (
    candidates.find((item) => item.is_primary) ||
    candidates.find((item) => (item.rank_order ?? 99) === 1) ||
    candidates[0] ||
    null
  );
}

export interface ProjectsTendersPanelProps {
  regions: Region[];
  /** When set, only events in this region id set are shown. */
  regionIds?: string[] | null;
  /** Keep unmapped「未知」rows on non-province scopes (global / China). */
  includeUnknown?: boolean;
}

export function ProjectsTendersPanel({
  regions,
  regionIds = null,
  includeUnknown = true,
}: ProjectsTendersPanelProps) {
  const defaultYearBounds = yearBounds(DEFAULT_ANALYTICS_YEAR);
  const [track, setTrack] = useState<BessProjectEventType | "all">("all");
  /** Analytics is always a single track — never mixed. */
  const [analyticsTrack, setAnalyticsTrack] =
    useState<BessProjectEventType>("tender");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [province, setProvince] = useState("");
  const [scene, setScene] = useState("");
  const [plantType, setPlantType] = useState("");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("year");
  const [year, setYear] = useState(DEFAULT_ANALYTICS_YEAR);
  const [month, setMonth] = useState<number | "">("");
  const [customFrom, setCustomFrom] = useState(defaultYearBounds.date_from);
  const [customTo, setCustomTo] = useState(defaultYearBounds.date_to);
  const [debouncedCustomFrom, setDebouncedCustomFrom] = useState(
    defaultYearBounds.date_from,
  );
  const [debouncedCustomTo, setDebouncedCustomTo] = useState(
    defaultYearBounds.date_to,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PagePayload | null>(null);
  const [analytics, setAnalytics] = useState<BessProjectAnalytics | null>(null);
  const [detailEvent, setDetailEvent] = useState<BessProjectEvent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const provinceOptions = useMemo(() => {
    const names = regions
      .filter((region) => region.region_type === "province")
      .map((region) => region.name_zh)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "zh-CN"));
    return ["未知", ...names];
  }, [regions]);

  const regionKey = regionIds?.join(",") ?? "";
  const effectiveMonth = typeof month === "number" ? month : null;
  /** Analytics window: yearly by default; list can further narrow by month. */
  const analyticsPeriod = useMemo(
    () =>
      resolvePeriodRange({
        mode: periodMode,
        year,
        month: null,
        customFrom: debouncedCustomFrom,
        customTo: debouncedCustomTo,
      }),
    [periodMode, year, debouncedCustomFrom, debouncedCustomTo],
  );
  /** List window: includes year/month filters under the charts. */
  const listPeriod = useMemo(
    () =>
      resolvePeriodRange({
        mode: periodMode,
        year,
        month: effectiveMonth,
        customFrom: debouncedCustomFrom,
        customTo: debouncedCustomTo,
      }),
    [
      periodMode,
      year,
      effectiveMonth,
      debouncedCustomFrom,
      debouncedCustomTo,
    ],
  );
  const chartRange = useMemo(() => {
    if (periodMode === "year") {
      return yearBounds(year);
    }
    return analyticsPeriod;
  }, [periodMode, year, analyticsPeriod]);
  const periodLabel = useMemo(
    () =>
      formatPeriodLabel({
        mode: periodMode,
        year,
        month: null,
        date_from: analyticsPeriod.date_from,
        date_to: analyticsPeriod.date_to,
      }),
    [
      periodMode,
      year,
      analyticsPeriod.date_from,
      analyticsPeriod.date_to,
    ],
  );
  const showTimeFilters = periodMode !== "custom";

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedCustomFrom(customFrom);
      setDebouncedCustomTo(customTo);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [customFrom, customTo]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
        include_unknown: includeUnknown ? "1" : "0",
      });
      if (track !== "all") params.set("event_type", track);
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (province) params.set("province", province);
      if (scene) params.set("scene", scene);
      if (plantType) params.set("plant_type", plantType);
      if (regionKey) params.set("region_ids", regionKey);
      if (listPeriod.date_from) params.set("date_from", listPeriod.date_from);
      if (listPeriod.date_to) params.set("date_to", listPeriod.date_to);

      try {
        const response = await fetch(
          `/api/public/project-events?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`加载失败（${response.status}）`);
        }
        const json = (await response.json()) as { data: PagePayload };
        setPayload(json.data);
        setSelectedId((current) => {
          const items = json.data.items;
          if (current && items.some((item) => item.id === current)) return current;
          return items[0]?.id ?? null;
        });
      } catch (loadError) {
        if ((loadError as Error).name === "AbortError") return;
        setError((loadError as Error).message || "加载失败");
        setPayload(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [
    track,
    debouncedQuery,
    province,
    scene,
    plantType,
    page,
    regionKey,
    includeUnknown,
    listPeriod.date_from,
    listPeriod.date_to,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadAnalytics() {
      setAnalyticsLoading(true);
      const params = new URLSearchParams({
        include_unknown: includeUnknown ? "1" : "0",
      });
      // Charts: single track + period. List track filters stay below.
      params.set("event_type", analyticsTrack);
      if (regionKey) params.set("region_ids", regionKey);
      if (analyticsPeriod.date_from) {
        params.set("date_from", analyticsPeriod.date_from);
      }
      if (analyticsPeriod.date_to) {
        params.set("date_to", analyticsPeriod.date_to);
      }

      try {
        const response = await fetch(
          `/api/public/project-events/analytics?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`analytics ${response.status}`);
        const json = (await response.json()) as { data: BessProjectAnalytics };
        setAnalytics(json.data);
      } catch (loadError) {
        if ((loadError as Error).name === "AbortError") return;
        setAnalytics(null);
      } finally {
        setAnalyticsLoading(false);
      }
    }
    void loadAnalytics();
    return () => controller.abort();
  }, [
    analyticsTrack,
    regionKey,
    includeUnknown,
    analyticsPeriod.date_from,
    analyticsPeriod.date_to,
  ]);

  const pageItems = payload?.items ?? [];
  const listSelected =
    pageItems.find((event) => event.id === selectedId) ?? pageItems[0] ?? null;
  const selectedAwardId =
    listSelected?.event_type === "award" ? listSelected.id : null;

  useEffect(() => {
    // Awards need full candidate lists; all other rows render list data directly.
    if (!selectedAwardId) return;

    const controller = new AbortController();
    async function loadDetail() {
      setDetailLoading(true);
      try {
        const response = await fetch(
          `/api/public/project-events/${selectedAwardId}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`detail ${response.status}`);
        const json = (await response.json()) as { data: BessProjectEvent };
        setDetailEvent(json.data);
      } catch (loadError) {
        if ((loadError as Error).name === "AbortError") return;
        setDetailEvent(null);
      } finally {
        setDetailLoading(false);
      }
    }
    void loadDetail();
    return () => controller.abort();
  }, [selectedAwardId]);

  // Track bar counts follow list filters, not the analytics window.
  const counts = payload?.counts ?? {
    all: 0,
    tender: 0,
    award: 0,
    commissioning: 0,
  };
  const pageCount = Math.max(1, Math.ceil((payload?.total ?? 0) / PAGE_SIZE));
  const selected =
    selectedAwardId && detailEvent?.id === selectedAwardId
      ? detailEvent
      : listSelected;
  const selectedDetailLoading = Boolean(selectedAwardId && detailLoading);
  const sources = payload?.sources ?? [];

  function resetPageFilters(updater: () => void) {
    updater();
    setPage(1);
    setSelectedId(null);
  }

  return (
    <section
      className="gl-panel gl-feed-panel gl-projects-panel"
      id="projects-tenders"
      role="tabpanel"
      aria-labelledby="dashboard-module-tab-projects"
    >
      <div className="gl-panel-header">
        <div>
          <div className="gl-section-kicker">03 · Projects &amp; tenders</div>
          <h2 id="projects-tenders-title">项目与招标</h2>
        </div>
        <span className="gl-record-count">
          {payload ? `${payload.total} 条` : loading ? "加载中…" : "0 条"}
          {sources.length ? ` · 数据源 ${sources.join(" / ")}` : ""}
        </span>
      </div>

      <ProjectsAnalyticsCharts
        analytics={analytics}
        loading={analyticsLoading}
        dateFrom={chartRange.date_from}
        dateTo={chartRange.date_to}
        periodLabel={`${TRACK_LABEL[analyticsTrack]} · ${periodLabel}`}
        periodMode={periodMode}
        analyticsTrack={analyticsTrack}
        customFrom={customFrom}
        customTo={customTo}
        onAnalyticsTrackChange={setAnalyticsTrack}
        onPeriodModeChange={(mode) =>
          resetPageFilters(() => setPeriodMode(mode))
        }
        onCustomFromChange={(value) => {
          setCustomFrom(value);
          setPage(1);
        }}
        onCustomToChange={(value) => {
          setCustomTo(value);
          setPage(1);
        }}
      />

      <div className="gl-projects-toolbar">
        <div className="gl-mode-switch" role="tablist" aria-label="项目轨道">
          {TRACKS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={track === item.id}
              className={track === item.id ? "is-active" : undefined}
              onClick={() => resetPageFilters(() => setTrack(item.id))}
            >
              {item.label}
              <span className="gl-projects-count">
                {counts[item.id as keyof typeof counts] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <label className="gl-projects-search">
          <span className="gl-sr-only">搜索项目</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="搜索项目 / 业主"
          />
        </label>
      </div>

      <div className="gl-projects-filters" aria-label="列表筛选">
        <div className="gl-projects-filters-head">
          <span className="gl-projects-filters-label">列表筛选</span>
          <span className="gl-projects-filters-note">
            年份同步上方分析；月份与其他条件筛选下方列表
          </span>
        </div>
        <div
          className={`gl-projects-filters-grid ${showTimeFilters ? "has-time" : ""}`}
        >
          {showTimeFilters ? (
            <>
              <label>
                <span>年份</span>
                <select
                  value={String(year)}
                  onChange={(event) =>
                    resetPageFilters(() => {
                      setYear(Number(event.target.value));
                      setMonth("");
                    })
                  }
                >
                  {ANALYTICS_YEAR_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} 年
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>月份</span>
                <select
                  value={month === "" ? "" : String(month)}
                  onChange={(event) =>
                    resetPageFilters(() => {
                      const next = event.target.value;
                      setMonth(next ? Number(next) : "");
                    })
                  }
                >
                  <option value="">全年</option>
                  {MONTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label>
            <span>省份</span>
            <select
              value={province}
              onChange={(event) =>
                resetPageFilters(() => setProvince(event.target.value))
              }
            >
              <option value="">全部省份</option>
              {provinceOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>应用场景</span>
            <select
              value={scene}
              onChange={(event) =>
                resetPageFilters(() => setScene(event.target.value))
              }
            >
              <option value="">全部场景</option>
              {SCENE_OPTIONS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>电站类型</span>
            <select
              value={plantType}
              onChange={(event) =>
                resetPageFilters(() => setPlantType(event.target.value))
              }
            >
              <option value="">全部类型</option>
              {PLANT_OPTIONS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <div className="gl-empty-state">{error}</div> : null}

      {!loading && !error && !pageItems.length ? (
        <div className="gl-empty-state">没有匹配的项目记录，试试调整筛选。</div>
      ) : null}

      {pageItems.length || loading ? (
        <div className="gl-projects-layout">
          <div className="gl-projects-list" role="list">
            {loading && !pageItems.length ? (
              <div className="gl-empty-state">正在加载项目数据…</div>
            ) : null}
            {pageItems.map((event) => {
              const primary = primaryCandidate(event);
              const active = listSelected?.id === event.id;
              return (
                <button
                  type="button"
                  role="listitem"
                  key={event.id}
                  className={`gl-projects-item ${active ? "is-active" : ""}`}
                  onClick={() => setSelectedId(event.id)}
                >
                  <div className="gl-projects-item-meta">
                    <span className={`gl-projects-track is-${event.event_type}`}>
                      {TRACK_LABEL[event.event_type]}
                    </span>
                    <time dateTime={event.event_date}>
                      {formatDate(event.event_date)}
                    </time>
                    <span>{event.province_label}</span>
                  </div>
                  <strong>{event.title}</strong>
                  <div className="gl-projects-item-foot">
                    <span>{scaleText(event)}</span>
                    {event.event_type === "award" && primary ? (
                      <span>{primary.candidate_name}</span>
                    ) : (
                      <span>
                        {event.scope_label ||
                          event.scene ||
                          event.status_label ||
                          "—"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {pageCount > 1 ? (
              <div className="gl-projects-pager">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  上一页
                </button>
                <span>
                  {page} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={page >= pageCount || loading}
                  onClick={() =>
                    setPage((value) => Math.min(pageCount, value + 1))
                  }
                >
                  下一页
                </button>
              </div>
            ) : null}
          </div>

          <aside className="gl-projects-detail" aria-label="项目详情">
            {selected ? (
              <>
                <div className="gl-projects-detail-kicker">
                  <span className={`gl-projects-track is-${selected.event_type}`}>
                    {TRACK_LABEL[selected.event_type]}
                  </span>
                  <span>{selected.source_name}</span>
                  {selectedDetailLoading ? <span>候选人加载中…</span> : null}
                </div>
                <h3>{selected.title}</h3>
                <dl className="gl-projects-kv">
                  <div>
                    <dt>日期</dt>
                    <dd>{formatDate(selected.event_date)}</dd>
                  </div>
                  <div>
                    <dt>地区</dt>
                    <dd>
                      {selected.province_label}
                      {selected.city_raw ? ` · ${selected.city_raw}` : ""}
                      {selected.region_bloc ? ` · ${selected.region_bloc}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>规模</dt>
                    <dd>{scaleText(selected)}</dd>
                  </div>
                  <div>
                    <dt>场景 / 类型</dt>
                    <dd>
                      {[selected.scene, selected.plant_type, selected.technology]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {selected.event_type === "commissioning" ? "业主" : "招标人"}
                    </dt>
                    <dd>
                      {[selected.owner_name, selected.owner_group]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {selected.event_type === "tender"
                        ? "招标内容"
                        : selected.event_type === "award"
                          ? "中标内容"
                          : "进展"}
                    </dt>
                    <dd>
                      {selected.scope_label ||
                        selected.status_label ||
                        selected.counterparty_name ||
                        "—"}
                    </dd>
                  </div>
                </dl>

                {selected.summary ? (
                  <p className="gl-projects-summary">{selected.summary}</p>
                ) : null}

                {selected.event_type === "award" &&
                (selected.candidates?.length ?? 0) > 0 ? (
                  <div className="gl-projects-candidates">
                    <h4>中标候选人</h4>
                    <ul>
                      {(selected.candidates ?? []).map((candidate) => (
                        <li key={candidate.id}>
                          <strong>
                            {candidate.rank_label}
                            {candidate.is_primary ? " · 首选" : ""}
                          </strong>
                          <span>
                            {candidate.candidate_name}
                            {candidate.candidate_group
                              ? `（${candidate.candidate_group}）`
                              : ""}
                          </span>
                          <em>
                            {[
                              candidate.bid_amount_wan != null
                                ? `${formatNullableNumber(candidate.bid_amount_wan)} 万元`
                                : null,
                              candidate.unit_price_yuan_per_wh != null
                                ? `${formatNullableNumber(candidate.unit_price_yuan_per_wh)} 元/Wh`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "报价未公布"}
                          </em>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {selected.province_raw && selected.province_label === "未知" ? (
                  <p className="gl-boundary-note">
                    原始地区字段未映射到省级目录：{selected.province_raw}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="gl-empty-state">
                {loading ? "加载中…" : "选择左侧项目查看详情。"}
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
