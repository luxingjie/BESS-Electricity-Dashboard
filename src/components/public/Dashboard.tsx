"use client";

import type {
  ChinaCfdAuction,
  MarketMetric,
  ProvinceTopicRecordWithFields,
  PublicBessProjectEvent,
  Region,
  Signal,
} from "@/lib/types";
import Link from "next/link";
import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";

import { descendantRegionIds } from "@/lib/regions/descendant-ids";
import {
  isPublishedSignal,
  type PublishedSignal,
} from "@/lib/domain/public-signal";
import {
  DASHBOARD_MODULE_META,
  dashboardModuleFromPathname,
  dashboardModuleHref,
  type DashboardModule,
} from "@/lib/regions/dashboard-modules";

import { ChinaCfdAuctionTable } from "./ChinaCfdAuctionTable";
import { ChinaProvinceMarketAtlas } from "./ChinaProvinceMarketAtlas";
import { PolicyFeed } from "./PolicyFeed";
import { ProjectsTendersPanel } from "./ProjectsTendersPanel";
import {
  RegionSelector,
  type RegionSelectorProps,
} from "./RegionDirectory";
import { SpGlobalStorageOutlook } from "./SpGlobalStorageOutlook";

export { RegionSelector };
export type { RegionSelectorProps };
import {
  formatDate,
  formatNullableNumber,
  formatOptionalText,
  normalizedStatusLabel,
  statusClassName,
} from "./formatters";

type RegionHref = (region: Region) => string;
type SignalHref = (signal: Signal) => string;

type DemoAware = { is_demo?: boolean };

function isDemo(record: unknown): boolean {
  return Boolean((record as DemoAware | null)?.is_demo);
}

function defaultRegionHref(region: Region): string {
  return region.region_type === "global" ? "/" : `/regions/${region.slug}`;
}

function defaultSignalHref(signal: Signal): string {
  return `/signals/${signal.id}`;
}

function regionName(region: Region | undefined): string {
  return region?.name_zh || region?.name_en || region?.code || "未命名地区";
}

function scopedRegionIds(regions: Region[], activeRegion?: Region | null): Set<string> | null {
  if (!activeRegion || activeRegion.region_type === "global") return null;
  return descendantRegionIds(regions, activeRegion.id);
}

function byNewestSignal(left: Signal, right: Signal): number {
  const leftDate = left.event_date || left.published_at || left.created_at;
  const rightDate = right.event_date || right.published_at || right.created_at;
  return String(rightDate || "").localeCompare(String(leftDate || ""));
}

function matchesSearch(
  signal: PublishedSignal,
  query: string,
  regionsById: Map<string, Region>,
): boolean {
  if (!query) return true;
  const region = regionsById.get(signal.region_id);
  const haystack = [
    signal.title,
    signal.summary,
    signal.category,
    signal.signal_type,
    signal.source_name,
    signal.original_status,
    signal.normalized_status,
    region?.name_zh,
    region?.name_en,
    region?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-CN");

  return haystack.includes(query.toLocaleLowerCase("zh-CN"));
}

function publishedSignalsOnly(signals: Signal[]): PublishedSignal[] {
  return signals.filter(isPublishedSignal);
}

function publishedMetricsOnly(metrics: MarketMetric[]): MarketMetric[] {
  return metrics.filter((metric) => metric.is_published === true);
}

function regionTypeLabel(region?: Region | null): string {
  if (!region) return "全局";
  switch (region.region_type) {
    case "global":
      return "全局";
    case "continent":
      return "大洲";
    case "country":
      return "国家";
    case "province":
      return "省份";
    default:
      return "地区";
  }
}

function heroSubtitle(activeRegion?: Region | null): string {
  if (!activeRegion || activeRegion.region_type === "global") {
    return "情报总览";
  }
  if (activeRegion.region_type === "province") return "本省情报总览";
  if (activeRegion.region_type === "country") return "本国情报总览";
  return "区域情报总览";
}

function heroDescription(args: {
  activeRegion?: Region | null;
  isChinaScope: boolean;
}): string {
  const { activeRegion, isChinaScope } = args;
  if (isChinaScope) {
    return "默认展示政策动态；点击下方模块在本页切换项目与招标、市场数据，以及电力市场与储能政策专题。";
  }
  if (!activeRegion || activeRegion.region_type === "global") {
    return "默认展示政策动态；点击下方模块在本页切换内容，左侧片区可下钻到国家。";
  }
  return "默认展示政策动态；点击下方模块在本页切换项目与招标、市场数据。";
}

function signalEventDay(signal: Signal): string {
  return (signal.event_date || signal.published_at || signal.created_at || "").slice(
    0,
    10,
  );
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export interface SearchFormProps {
  defaultValue?: string;
  action?: string;
}

export function SearchForm({ defaultValue = "", action = "/" }: SearchFormProps) {
  return (
    <form className="gl-search-box" action={action} method="get" role="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <label className="gl-sr-only" htmlFor="public-search">
        搜索已发布内容
      </label>
      <input
        id="public-search"
        name="q"
        type="search"
        placeholder="搜索地区、政策、市场信号…"
        defaultValue={defaultValue}
        autoComplete="off"
      />
      <button type="submit">搜索</button>
    </form>
  );
}

export interface StatusPillProps {
  status: string | null | undefined;
}

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span className={`gl-status-pill ${statusClassName(status)}`} data-status={status || "other"}>
      {normalizedStatusLabel(status)}
    </span>
  );
}

export interface SignalListProps {
  signals: Signal[];
  regions: Region[];
  getSignalHref?: SignalHref;
}

export function SignalList({
  signals,
  regions,
  getSignalHref = defaultSignalHref,
}: SignalListProps) {
  const regionsById = new Map(regions.map((region) => [region.id, region]));
  const published = publishedSignalsOnly(signals);

  if (!published.length) {
    return <div className="gl-empty-state">没有匹配的已发布动态。</div>;
  }

  return (
    <div className="gl-policy-feed">
      {published.map((signal) => {
        const region = regionsById.get(signal.region_id);
        return (
          <a className="gl-policy-item" href={getSignalHref(signal)} key={signal.id}>
            <div className="gl-policy-date">
              {formatDate(signal.event_date || signal.published_at)}
              <strong>{regionName(region)}</strong>
            </div>
            <div className="gl-policy-content">
              <div className="gl-pill-row">
                <StatusPill status={signal.normalized_status} />
                {isDemo(signal) ? <span className="gl-demo-pill">Demo</span> : null}
              </div>
              <h3>{signal.title}</h3>
              <p>{signal.summary}</p>
              <div className="gl-policy-tags">
                {signal.category ? <span className="gl-policy-tag"># {signal.category}</span> : null}
                {signal.signal_type ? <span className="gl-policy-tag"># {signal.signal_type}</span> : null}
                {signal.impact_level ? <span className="gl-policy-tag"># IMPACT {signal.impact_level}</span> : null}
                {signal.source_name ? <span className="gl-policy-tag"># {signal.source_name}</span> : null}
              </div>
            </div>
            <span className="gl-policy-arrow" aria-hidden="true">
              →
            </span>
          </a>
        );
      })}
    </div>
  );
}

export interface MarketMetricsProps {
  metrics: MarketMetric[];
  regions: Region[];
  compact?: boolean;
}

export function MarketMetrics({ metrics, regions, compact = false }: MarketMetricsProps) {
  const regionsById = new Map(regions.map((region) => [region.id, region]));
  const published = publishedMetricsOnly(metrics);

  if (!published.length) {
    return (
      <div className="gl-empty-state gl-empty-state-bordered">
        当前地区暂无已发布市场指标；缺失值不会按 0 展示。
      </div>
    );
  }

  return (
    <div className={compact ? "gl-kpi-strip" : "gl-metric-grid"}>
      {published.map((metric) => {
        const value = formatNullableNumber(metric.value);
        const region = regionsById.get(metric.region_id);
        return (
          <article className={compact ? "gl-kpi" : "gl-metric-card"} key={metric.id}>
            <div className="gl-kpi-label">
              <i aria-hidden="true" />
              <span>{metric.label}</span>
              {metric.is_demo ? <span className="gl-demo-pill">Demo</span> : null}
            </div>
            <div className="gl-kpi-value">
              <strong>{value}</strong>
              {value !== "—" && metric.unit ? <span>{metric.unit}</span> : null}
            </div>
            <div className="gl-kpi-trend">
              {region ? `${regionName(region)} · ` : ""}
              {formatOptionalText(metric.period_label)}
            </div>
            {!compact ? (
              <div className="gl-metric-meta">
                <span>截至 {formatDate(metric.as_of_date)}</span>
                <span>{formatOptionalText(metric.source_name)}</span>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export interface DashboardProps {
  regions: Region[];
  signals: Signal[];
  marketMetrics: MarketMetric[];
  provinceTopics: ProvinceTopicRecordWithFields[];
  cfdAuctions?: ChinaCfdAuction[];
  projectEvents?: PublicBessProjectEvent[];
  activeRegion?: Region | null;
  /** Content module shown under the shared hero (defaults to policy). */
  activeModule?: DashboardModule;
  searchQuery?: string;
  searchAction?: string;
  getRegionHref?: RegionHref;
  getSignalHref?: SignalHref;
}

export function Dashboard({
  regions,
  signals,
  marketMetrics,
  provinceTopics,
  cfdAuctions = [],
  activeRegion,
  activeModule = "policy",
  searchQuery = "",
  searchAction,
  getRegionHref = defaultRegionHref,
}: DashboardProps) {
  // Soft-switch modules in the client so tab clicks don't re-fetch the whole
  // dashboard RSC payload (each route is force-dynamic + Supabase).
  const moduleStateKey = `${activeRegion?.id ?? "global"}:${activeModule}`;
  const [moduleState, setModuleState] = useState<{
    key: string;
    module: DashboardModule;
  }>({ key: moduleStateKey, module: activeModule });
  const currentModule =
    moduleState.key === moduleStateKey ? moduleState.module : activeModule;

  useEffect(() => {
    const onPopState = () => {
      setModuleState({
        key: moduleStateKey,
        module: dashboardModuleFromPathname(window.location.pathname),
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [moduleStateKey]);

  const switchModule = (module: DashboardModule, href: string) => {
    if (module === currentModule) return;
    setModuleState({ key: moduleStateKey, module });
    // Replace (don't push) so Back returns to the previous place/region,
    // not every intermediate module click.
    window.history.replaceState({ module }, "", href);
  };

  const isModifiedClick = (event: MouseEvent) =>
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0;

  const regionsById = new Map(regions.map((region) => [region.id, region]));
  const regionIds = scopedRegionIds(regions, activeRegion);
  const publishedSignals = publishedSignalsOnly(signals)
    .filter((signal) => !regionIds || regionIds.has(signal.region_id))
    .filter((signal) => matchesSearch(signal, searchQuery.trim(), regionsById))
    .sort(byNewestSignal);
  const publishedMetrics = publishedMetricsOnly(marketMetrics).filter(
    (metric) => !regionIds || regionIds.has(metric.region_id),
  );
  const scopedProvinceTopics = provinceTopics.filter(
    (record) =>
      record.review_status === "published" &&
      record.published_at !== null &&
      (!regionIds || regionIds.has(record.region_id)),
  );
  const realPublishedSignals = publishedSignals.filter((signal) => !isDemo(signal));
  // Regions are structural seed/reference rows. A real Signal must never inherit
  // a Demo label only because its region was preloaded by the MVP seed.
  const hasDemoData =
    publishedSignals.some(isDemo) ||
    publishedMetrics.some((metric) => metric.is_demo) ||
    scopedProvinceTopics.some((record) => record.is_demo);
  const activeName = activeRegion ? regionName(activeRegion) : "全局观察";
  const resolvedSearchAction = searchAction || (activeRegion ? getRegionHref(activeRegion) : "/");
  const chinaRegion = regions.find(
    (region) =>
      region.region_type === "country" &&
      (region.slug === "china" || region.code === "CN"),
  );
  const isChinaScope = Boolean(
    chinaRegion &&
      activeRegion &&
      (activeRegion.id === chinaRegion.id || activeRegion.parent_id === chinaRegion.id),
  );
  const showRegionPolicyArchive = Boolean(
    activeRegion && activeRegion.region_type !== "global",
  );
  const recentPolicyCount = realPublishedSignals.filter(
    (signal) => signalEventDay(signal) >= daysAgoIso(30),
  ).length;
  const scopedCountryCount = (() => {
    if (!activeRegion || activeRegion.region_type === "global") {
      return regions.filter((region) => region.region_type === "country").length;
    }
    if (activeRegion.region_type === "continent") {
      return regions.filter(
        (region) =>
          region.region_type === "country" && region.parent_id === activeRegion.id,
      ).length;
    }
    return null;
  })();
  const subtitle = heroSubtitle(activeRegion);
  const description = heroDescription({
    activeRegion,
    isChinaScope,
  });
  const moduleLabel = DASHBOARD_MODULE_META[currentModule].label;
  const moduleLinks = (
    ["policy", "projects", "market", "topics"] as DashboardModule[]
  )
    .filter((module) => module !== "topics" || isChinaScope)
    .map((module) => ({
      key: module,
      href: dashboardModuleHref(module, activeRegion),
      index: DASHBOARD_MODULE_META[module].index,
      label: DASHBOARD_MODULE_META[module].label,
      detail:
        module === "policy"
          ? `${realPublishedSignals.length} 条已发布`
          : module === "market"
            ? "全球储能展望"
            : module === "projects"
              ? "招标 / 中标 / 并网"
              : DASHBOARD_MODULE_META[module].detail,
      active: currentModule === module,
    }));

  const handleModuleTabKeyDown = (
    event: KeyboardEvent<HTMLAnchorElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % moduleLinks.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + moduleLinks.length) % moduleLinks.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = moduleLinks.length - 1;
    }
    if (nextIndex === null) return;

    event.preventDefault();
    const next = moduleLinks[nextIndex];
    // Projects route loads a large dataset; use real navigation.
    if (next.key === "projects" || currentModule === "projects") {
      window.location.assign(next.href);
      return;
    }
    switchModule(next.key, next.href);
    document.getElementById(`dashboard-module-tab-${next.key}`)?.focus();
  };

  const modulePanelId = (module: DashboardModule) => {
    if (module === "policy") {
      return showRegionPolicyArchive ? "region-policy" : "policy";
    }
    if (module === "projects") return "projects-tenders";
    if (module === "market") return "market";
    return "china-topics";
  };

  return (
    <>
      {hasDemoData ? (
        <div className="gl-demo-ribbon" role="note">
          <span>Demo data</span> 演示记录仅用于产品验证，不代表真实政策或市场结论
        </div>
      ) : null}

      <div className={`gl-app-shell ${hasDemoData ? "has-demo-ribbon" : ""}`}>
        <aside className="gl-sidebar" aria-label="Jinko ESS 导航">
          <Link className="gl-brand" href="/" aria-label="Jinko ESS 首页">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="gl-brand-logo"
              src="/jinko-ess-logo.png"
              alt="Jinko ESS"
              width={168}
              height={102}
            />
            <div className="gl-brand-copy">
              <strong>Grid Ledger</strong>
              <span>Policy × Market Intelligence</span>
            </div>
          </Link>

          <nav className="gl-primary-nav" aria-label="总览模块">
            <div className="gl-directory-label">
              <span>Dashboard</span>
              <i aria-hidden="true" />
            </div>
            <Link
              className="gl-nav-button is-active"
              href={dashboardModuleHref("overview", activeRegion)}
              aria-current="page"
            >
              <span className="gl-nav-index">01</span>
              <span>总览</span>
            </Link>
          </nav>

          <RegionSelector
            regions={regions}
            signals={signals}
            activeRegionId={activeRegion?.id}
          />

          <div className="gl-sidebar-footer">
            <div className="gl-live-row">
              <span className="gl-live-dot" />
              <strong>已发布数据</strong>
            </div>
            <span>公开端仅展示已发布记录</span>
          </div>
        </aside>

        <main className="gl-workspace">
          <header className="gl-topbar">
            <div className="gl-breadcrumb">
              <Link href={dashboardModuleHref("overview", activeRegion)}>
                总览
              </Link>
              <span>/</span>
              <strong>{activeName}</strong>
              <span>/</span>
              <strong>{moduleLabel}</strong>
            </div>
            <SearchForm defaultValue={searchQuery} action={resolvedSearchAction} />
            <a className="gl-view-button" href="/admin/login">
              ADMIN
            </a>
          </header>

          <section className="gl-hero" aria-labelledby="overview-title">
            <div className="gl-hero-copy">
              <div className="gl-eyebrow">{regionTypeLabel(activeRegion)}</div>
              <h1 id="overview-title">
                {activeName}
                <br />
                <em>{subtitle}</em>
              </h1>
              <p className="gl-hero-description">{description}</p>
            </div>
            <div className="gl-hero-meta">
              <div className="gl-meta-row">
                <span>近30天政策</span>
                <strong className="good">{recentPolicyCount}</strong>
              </div>
              {scopedCountryCount != null ? (
                <div className="gl-meta-row">
                  <span>覆盖国家</span>
                  <strong>{scopedCountryCount}</strong>
                </div>
              ) : (
                <div className="gl-meta-row">
                  <span>已发布政策</span>
                  <strong>{realPublishedSignals.length}</strong>
                </div>
              )}
              <div className="gl-meta-row">
                <span>第三方展望</span>
                <strong>1</strong>
              </div>
            </div>
            <nav
              className="gl-module-jump"
              aria-label="内容模块"
              role="tablist"
            >
              {moduleLinks.map((module, index) => (
                <Link
                  key={module.key}
                  id={`dashboard-module-tab-${module.key}`}
                  className={`gl-module-card ${module.active ? "is-active" : ""}`}
                  href={module.href}
                  role="tab"
                  aria-selected={module.active}
                  aria-controls={modulePanelId(module.key)}
                  tabIndex={module.active ? 0 : -1}
                  onClick={(event) => {
                    if (isModifiedClick(event)) return;
                    event.preventDefault();
                    switchModule(module.key, module.href);
                  }}
                  onKeyDown={(event) => handleModuleTabKeyDown(event, index)}
                >
                  <span className="gl-nav-index">{module.index}</span>
                  <strong>{module.label}</strong>
                  <small>{module.detail}</small>
                </Link>
              ))}
            </nav>
          </section>

          <div className="gl-mode-row">
            <div />
            <div className="gl-asof">仅展示已发布数据 · 当前：{moduleLabel}</div>
          </div>

          {currentModule === "policy" ? (
            showRegionPolicyArchive ? (
              <section
                className="gl-panel gl-feed-panel"
                id="region-policy"
                role="tabpanel"
                aria-labelledby="dashboard-module-tab-policy"
              >
                <PolicyFeed
                  signals={signals}
                  regions={regions}
                  variant="region-archive"
                  archiveRegion={activeRegion}
                />
              </section>
            ) : (
              <section
                className="gl-panel gl-feed-panel"
                id="policy"
                role="tabpanel"
                aria-labelledby="dashboard-module-tab-policy"
              >
                <PolicyFeed
                  signals={signals}
                  regions={regions}
                  variant="global"
                  initialRegionId=""
                />
              </section>
            )
          ) : null}

          {currentModule === "projects" ? (
            <ProjectsTendersPanel
              regions={regions}
              regionIds={
                activeRegion && activeRegion.region_type !== "global" && regionIds
                  ? [...regionIds]
                  : null
              }
              includeUnknown={activeRegion?.region_type !== "province"}
            />
          ) : null}

          {currentModule === "market" ? (
            <section
              className="gl-panel gl-market-panel"
              id="market"
              role="tabpanel"
              aria-labelledby="dashboard-module-tab-market"
            >
              <div className="gl-panel-header">
                <div>
                  <div className="gl-section-kicker">04 · Market data</div>
                  <h2>市场数据</h2>
                </div>
                <span className="gl-record-count">第三方展望已接入</span>
              </div>
              <SpGlobalStorageOutlook />
            </section>
          ) : null}

          {currentModule === "topics" && isChinaScope && chinaRegion ? (
            <section
              className="gl-china-module"
              id="china-topics"
              role="tabpanel"
              aria-labelledby="dashboard-module-tab-topics"
              aria-label="电力市场与储能政策专题"
            >
              <div className="gl-panel-header gl-china-module-header">
                <div>
                  <div className="gl-section-kicker">
                    05 · Power market &amp; storage
                  </div>
                  <h2>电力市场与储能政策专题</h2>
                </div>
                {cfdAuctions.length ? (
                  <nav className="gl-mode-switch" aria-label="中国专题快捷入口">
                    <a href="#china-cfd-overview">机制电价</a>
                    <a href="#china-cfd-auctions">竞价总表</a>
                  </nav>
                ) : null}
              </div>
              <ChinaProvinceMarketAtlas
                regions={regions}
                chinaRegionId={chinaRegion.id}
                signals={signals}
                marketMetrics={marketMetrics}
                provinceTopics={provinceTopics}
                cfdAuctions={cfdAuctions}
                initialProvinceId={
                  activeRegion?.region_type === "province"
                    ? activeRegion.id
                    : undefined
                }
                initialTopicId={
                  cfdAuctions.length
                    ? "renewable-mechanism-price"
                    : "trading-rules"
                }
              />
              <ChinaCfdAuctionTable auctions={cfdAuctions} />
            </section>
          ) : null}
        </main>
      </div>
    </>
  );
}
