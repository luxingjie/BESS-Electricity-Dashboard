import type {
  ChinaCfdAuction,
  MarketMetric,
  NormalizedStatus,
  ProvinceTopicRecordWithFields,
  Region,
  Signal,
} from "@/lib/types";
import Link from "next/link";

import { compareContinents, compareCountries } from "@/lib/region-order";
import { descendantRegionIds } from "@/lib/regions/descendant-ids";

import { ChinaCfdAuctionTable } from "./ChinaCfdAuctionTable";
import { ChinaProvinceMarketAtlas } from "./ChinaProvinceMarketAtlas";
import { GlobalMarketDirectory } from "./GlobalMarketDirectory";
import { PolicyFeed } from "./PolicyFeed";
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

export type PublishedSignal = Signal & {
  region_id: string;
  title: string;
  summary: string;
  source_url: string;
  normalized_status: NormalizedStatus;
  reviewer_note: string;
};

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

function regionCode(region: Region): string {
  return region.code || region.name_en || region.region_type;
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

export function isPublishedSignal(signal: Signal): signal is PublishedSignal {
  return (
    signal.review_status === "published" &&
    Boolean(signal.published_at) &&
    Boolean(signal.region_id?.trim()) &&
    Boolean(signal.title?.trim()) &&
    Boolean(signal.summary?.trim()) &&
    Boolean(signal.source_url?.trim()) &&
    Boolean(signal.normalized_status) &&
    Boolean(signal.reviewer_note?.trim())
  );
}

function publishedSignalsOnly(signals: Signal[]): PublishedSignal[] {
  return signals.filter(isPublishedSignal);
}

function publishedMetricsOnly(metrics: MarketMetric[]): MarketMetric[] {
  return metrics.filter((metric) => metric.is_published === true);
}

export interface RegionSelectorProps {
  regions: Region[];
  signals?: Signal[];
  activeRegionId?: string | null;
  allHref?: string;
  getRegionHref?: RegionHref;
}

export function RegionSelector({
  regions,
  signals = [],
  activeRegionId,
  allHref = "/",
  getRegionHref = defaultRegionHref,
}: RegionSelectorProps) {
  const globalRegion = regions.find((region) => region.region_type === "global");
  const continents = regions
    .filter((region) => region.region_type === "continent")
    .sort(compareContinents);
  const countries = regions
    .filter((region) => region.region_type === "country")
    .sort(compareCountries);
  const provinces = regions.filter((region) => region.region_type === "province");
  const published = publishedSignalsOnly(signals);
  const realPublished = published.filter((signal) => !isDemo(signal));
  const demoPublished = published.filter(isDemo);
  const activeRegion = regions.find((region) => region.id === activeRegionId);
  const activeCountry =
    activeRegion?.region_type === "country"
      ? activeRegion
      : activeRegion?.region_type === "province"
        ? countries.find((country) => country.id === activeRegion.parent_id)
        : undefined;
  const activeCountryId =
    activeCountry?.id ?? null;
  const activeContinentId =
    activeRegion?.region_type === "continent"
      ? activeRegion.id
      : activeCountry?.parent_id ?? null;

  const countForRegion = (region: Region) => {
    const ids = descendantRegionIds(regions, region.id);
    return {
      real: realPublished.filter((signal) => ids.has(signal.region_id)).length,
      demo: demoPublished.filter((signal) => ids.has(signal.region_id)).length,
    };
  };
  const globalCounts = {
    real: realPublished.length,
    demo: demoPublished.length,
  };

  return (
    <nav className="gl-region-directory" aria-label="地区选择器">
      <div className="gl-directory-label">
        <span>Area directory</span>
        <i aria-hidden="true" />
      </div>

      <a
        className={`gl-region-button ${
          !activeRegionId || activeRegionId === globalRegion?.id ? "is-active" : ""
        }`}
        href={globalRegion ? getRegionHref(globalRegion) : allHref}
        aria-current={!activeRegionId || activeRegionId === globalRegion?.id ? "page" : undefined}
        aria-label={`${globalRegion ? regionName(globalRegion) : "全局观察"}，真实 ${globalCounts.real} 条，Demo ${globalCounts.demo} 条`}
      >
        <span className="gl-region-dot" />
        <span>{globalRegion ? regionName(globalRegion) : "全局观察"}</span>
        <span className="gl-region-count">{String(globalCounts.real).padStart(2, "0")}</span>
      </a>

      <div className="gl-region-group">Continent / 大洲</div>
      {continents.map((continent) => {
        const continentCounts = countForRegion(continent);
        const continentCountries = countries.filter(
          (country) => country.parent_id === continent.id,
        );
        const showCountries = activeContinentId === continent.id;
        return (
          <div className="gl-continent-cluster" key={continent.id}>
            <a
              className={`gl-region-button is-continent ${
                activeRegionId === continent.id ? "is-active" : ""
              }`}
              href={getRegionHref(continent)}
              aria-current={activeRegionId === continent.id ? "page" : undefined}
              aria-label={`${regionName(continent)}，真实 ${continentCounts.real} 条，Demo ${continentCounts.demo} 条`}
              title={`${regionName(continent)} · Demo ${continentCounts.demo}`}
            >
              <span className="gl-region-dot" />
              <span>
                {regionName(continent)} <small>· {regionCode(continent)}</small>
              </span>
              <span className="gl-region-count">
                {String(continentCounts.real).padStart(2, "0")}
              </span>
            </a>
            {showCountries ? <div className="gl-country-stack">
              {continentCountries.map((country) => {
                const countryCounts = countForRegion(country);
                const countryProvinces = provinces.filter(
                  (province) => province.parent_id === country.id,
                );
                const showProvinces = activeCountryId === country.id;
                return (
                  <div className="gl-country-cluster" key={country.id}>
                    <a
                      className={`gl-region-button is-country ${
                        activeRegionId === country.id ? "is-active" : ""
                      }`}
                      href={getRegionHref(country)}
                      aria-current={activeRegionId === country.id ? "page" : undefined}
                      aria-label={`${regionName(country)}，真实 ${countryCounts.real} 条，Demo ${countryCounts.demo} 条`}
                      title={`${regionName(country)} · Demo ${countryCounts.demo}`}
                    >
                      <span className="gl-region-dot" />
                      <span>
                        {regionName(country)} <small>· {regionCode(country)}</small>
                      </span>
                      <span className="gl-region-count">
                        {String(countryCounts.real).padStart(2, "0")}
                      </span>
                    </a>
                    {showProvinces
                      ? countryProvinces.map((province) => {
                          const provinceCounts = countForRegion(province);
                          return (
                          <a
                            className={`gl-region-button is-province ${
                              activeRegionId === province.id ? "is-active" : ""
                            }`}
                            href={getRegionHref(province)}
                            aria-current={
                              activeRegionId === province.id ? "page" : undefined
                            }
                            aria-label={`${regionName(province)}，真实 ${provinceCounts.real} 条，Demo ${provinceCounts.demo} 条`}
                            title={`${regionName(province)} · Demo ${provinceCounts.demo}`}
                            key={province.id}
                          >
                            <span className="gl-region-dot" />
                            <span>{regionName(province)}</span>
                            <span className="gl-region-count">
                              {String(provinceCounts.real).padStart(2, "0")}
                            </span>
                          </a>
                          );
                        })
                      : null}
                  </div>
                );
              })}
            </div> : null}
          </div>
        );
      })}

      {countries.some((country) => !country.parent_id) ? (
        <>
          <div className="gl-region-group">Unassigned / 未分组国家</div>
          {countries
            .filter((country) => !country.parent_id)
            .map((country) => (
              <a
                className={`gl-region-button is-country ${
                  activeRegionId === country.id ? "is-active" : ""
                }`}
                href={getRegionHref(country)}
                aria-current={activeRegionId === country.id ? "page" : undefined}
                aria-label={regionName(country)}
                key={country.id}
              >
                <span className="gl-region-dot" />
                <span>{regionName(country)}</span>
                <span className="gl-region-count">
                  {String(countForRegion(country)).padStart(2, "0")}
                </span>
              </a>
            ))}
        </>
      ) : null}

      {provinces.some((province) => !province.parent_id) ? (
        <>
          <div className="gl-region-group">Province / 省级</div>
          {provinces
            .filter((province) => !province.parent_id)
            .map((province) => (
              <a
                className={`gl-region-button ${activeRegionId === province.id ? "is-active" : ""}`}
                href={getRegionHref(province)}
                aria-current={activeRegionId === province.id ? "page" : undefined}
                aria-label={regionName(province)}
                key={province.id}
              >
                <span className="gl-region-dot" />
                <span>{regionName(province)}</span>
                <span className="gl-region-count">{String(countForRegion(province)).padStart(2, "0")}</span>
              </a>
            ))}
        </>
      ) : null}
    </nav>
  );
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
  activeRegion?: Region | null;
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
  searchQuery = "",
  searchAction,
  getRegionHref = defaultRegionHref,
  getSignalHref = defaultSignalHref,
}: DashboardProps) {
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
  const demoPublishedSignals = publishedSignals.filter(isDemo);
  const realPublishedMetrics = publishedMetrics.filter((metric) => !metric.is_demo);
  const demoPublishedMetrics = publishedMetrics.filter((metric) => metric.is_demo);
  // Regions are structural seed/reference rows. A real Signal must never inherit
  // a Demo label only because its region was preloaded by the MVP seed.
  const hasDemoData =
    publishedSignals.some(isDemo) ||
    publishedMetrics.some((metric) => metric.is_demo) ||
    scopedProvinceTopics.some((record) => record.is_demo);
  const statusCount = (status: string) =>
    realPublishedSignals.filter((signal) => signal.normalized_status === status).length;
  const activeName = activeRegion ? regionName(activeRegion) : "全局观察";
  const activeCode = activeRegion ? regionCode(activeRegion) : "GLOBAL WATCH";
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
  const isGlobalDirectoryScope = Boolean(
    !activeRegion ||
      activeRegion.region_type === "global" ||
      activeRegion.region_type === "continent",
  );
  const showRegionPolicyArchive = Boolean(
    activeRegion && activeRegion.region_type !== "global",
  );
  const demoRecordCount =
    demoPublishedSignals.length +
    demoPublishedMetrics.length +
    scopedProvinceTopics.filter((record) => record.is_demo).length;

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

          <nav className="gl-primary-nav" aria-label="页面区块">
            <a className="gl-nav-button is-active" href="#overview">
              <span className="gl-nav-index">01</span>
              <span>情报总览</span>
            </a>
            <a className="gl-nav-button" href="#market">
              <span className="gl-nav-index">02</span>
              <span>市场指标</span>
            </a>
            <a
              className="gl-nav-button"
              href={showRegionPolicyArchive ? "#region-policy" : "#policy"}
            >
              <span className="gl-nav-index">03</span>
              <span>{showRegionPolicyArchive ? "区域政策流" : "政策动态"}</span>
            </a>
            {isChinaScope ? (
              <a className="gl-nav-button" href="#china-market-atlas">
                <span className="gl-nav-index">04</span>
                <span>省级专题</span>
              </a>
            ) : isGlobalDirectoryScope ? (
              <a className="gl-nav-button" href="#global-market-directory">
                <span className="gl-nav-index">04</span>
                <span>大洲市场</span>
              </a>
            ) : null}
          </nav>

          <RegionSelector
            regions={regions}
            signals={signals}
            activeRegionId={activeRegion?.id}
            getRegionHref={getRegionHref}
          />

          <div className="gl-sidebar-footer">
            <div className="gl-live-row">
              <span className="gl-live-dot" />
              <strong>Published records</strong>
            </div>
            <span>公开端仅展示已发布数据</span>
          </div>
        </aside>

        <main className="gl-workspace" id="overview">
          <header className="gl-topbar">
            <div className="gl-breadcrumb">
              <span>Dashboard</span>
              <span>/</span>
              <strong>{activeName}</strong>
            </div>
            <SearchForm defaultValue={searchQuery} action={resolvedSearchAction} />
            <a className="gl-view-button" href="/admin/login">
              ADMIN
            </a>
          </header>

          <section className="gl-hero" data-index={activeRegion?.code || "01"}>
            <div className="gl-hero-copy">
              <div className="gl-eyebrow">{activeCode}</div>
              <h1>
                {activeRegion ? activeName : "Policy moves."}
                <br />
                <em>{activeRegion ? "policy & market desk." : "Markets answer."}</em>
              </h1>
              {showRegionPolicyArchive ? null : (
                <p className="gl-hero-description">
                  从已发布记录读取政策动态与市场指标。状态、日期、地区和原文来源彼此独立展示，草稿不会进入公开视图。
                </p>
              )}
            </div>
            <div className="gl-hero-meta">
              <div className="gl-meta-row">
                <span>Real published signals</span>
                <strong className="good">{realPublishedSignals.length}</strong>
              </div>
              <div className="gl-meta-row">
                <span>Real market metrics</span>
                <strong>{realPublishedMetrics.length}</strong>
              </div>
              <div className="gl-meta-row">
                <span>Demo fixtures</span>
                <strong>{demoRecordCount}</strong>
              </div>
            </div>
          </section>

          <div className="gl-mode-row">
            <nav className="gl-mode-switch" aria-label="内容导航">
              <a href={showRegionPolicyArchive ? "#region-policy" : "#policy"}>
                {showRegionPolicyArchive ? "区域政策流" : "政策动态"}
              </a>
              <a href="#market">市场指标</a>
              {isChinaScope ? <a href="#china-market-atlas">省级专题</a> : null}
              {isChinaScope && cfdAuctions.length ? (
                <a href="#china-cfd-auctions">机制电价总表</a>
              ) : null}
              {isGlobalDirectoryScope ? (
                <a href="#global-market-directory">大洲市场</a>
              ) : null}
            </nav>
            <div className="gl-asof">DATABASE-BACKED · PUBLISHED ONLY</div>
          </div>

          {showRegionPolicyArchive ? (
            <section className="gl-panel gl-feed-panel" id="region-policy">
              <PolicyFeed
                signals={signals}
                regions={regions}
                variant="region-archive"
                archiveRegion={activeRegion}
              />
            </section>
          ) : null}

          {isGlobalDirectoryScope ? (
            <GlobalMarketDirectory
              regions={regions}
              signals={signals}
              marketMetrics={marketMetrics}
              activeRegionId={activeRegion?.id}
              getRegionHref={getRegionHref}
              representativeCountryLimit={6}
            />
          ) : null}

          <section className="gl-dashboard-grid" id="market">
            <article className="gl-panel gl-market-panel">
              <div className="gl-panel-header">
                <div>
                  <div className="gl-section-kicker">Published market data</div>
                  <h2>市场指标</h2>
                </div>
                <span className="gl-record-count">
                  {realPublishedMetrics.length} REAL · {demoPublishedMetrics.length} DEMO
                </span>
              </div>
              <MarketMetrics metrics={publishedMetrics} regions={regions} />
            </article>

            <aside className="gl-panel gl-signal-panel" aria-label="政策状态分布">
              <div className="gl-panel-header">
                <div>
                  <div className="gl-section-kicker">Status ledger</div>
                  <h2>状态分账</h2>
                </div>
              </div>
              <div className="gl-status-ledger">
                {(["filed", "approved", "draft", "effective"] as const).map((status) => (
                  <div className="gl-status-row" key={status}>
                    <StatusPill status={status} />
                    <strong>{statusCount(status)}</strong>
                  </div>
                ))}
              </div>
              <p className="gl-boundary-note">
                Filed 不等于 Approved；Draft 不等于 Effective。状态统计仅计真实公开记录，Demo 另行标记。
              </p>
            </aside>
          </section>

          {isChinaScope && chinaRegion ? (
            <ChinaProvinceMarketAtlas
              regions={regions}
              chinaRegionId={chinaRegion.id}
              signals={signals}
              marketMetrics={marketMetrics}
              provinceTopics={provinceTopics}
              cfdAuctions={cfdAuctions}
              initialProvinceId={
                activeRegion?.region_type === "province" ? activeRegion.id : undefined
              }
            />
          ) : null}

          {isChinaScope ? <ChinaCfdAuctionTable auctions={cfdAuctions} /> : null}

          {!showRegionPolicyArchive ? (
            <section className="gl-panel gl-feed-panel" id="policy">
              <PolicyFeed
                signals={signals}
                regions={regions}
                variant="global"
                initialRegionId=""
              />
            </section>
          ) : null}
        </main>
      </div>
    </>
  );
}
