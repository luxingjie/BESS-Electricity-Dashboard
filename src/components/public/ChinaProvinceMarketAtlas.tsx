"use client";

import { useMemo, useState } from "react";

import {
  PROVINCE_TOPIC_FIELD_COVERAGE_LABELS,
  PROVINCE_TOPIC_LEGAL_STATUS_LABELS,
  PROVINCE_TOPIC_OPERATIONAL_STATUS_LABELS,
} from "@/lib/china-market/status";
import type {
  ChinaCfdAuction,
  MarketMetric,
  ProvinceTopicField,
  ProvinceTopicRecordWithFields,
  Region,
  Signal,
} from "@/lib/types";

import { ChinaCfdOverviewDashboard } from "./ChinaCfdOverviewDashboard";
import {
  ChinaProvinceCfdDossier,
  deriveMechanismFieldValue,
} from "./ChinaProvinceCfdDossier";
import {
  CHINA_MARKET_TOPICS,
  type ChinaMarketTopicId,
} from "./china-market-data";
import styles from "./ChinaProvinceMarketAtlas.module.css";

type TopicDefinition = (typeof CHINA_MARKET_TOPICS)[number];

function classNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

function regionLabel(region: Region): string {
  return region.name_zh || region.name_en || region.code || region.slug;
}

function regionMonogram(region: Region): string {
  return regionLabel(region).slice(0, 1);
}

function findChinaRegion(
  regions: readonly Region[],
  chinaRegionId?: string,
): Region | undefined {
  if (chinaRegionId) {
    return regions.find((region) => region.id === chinaRegionId);
  }
  return regions.find(
    (region) =>
      region.region_type === "country" &&
      (region.name_zh === "中国" ||
        region.slug === "china" ||
        region.code === "CN" ||
        region.code === "CHN"),
  );
}

function publishedSignalsOnly(signals: readonly Signal[]): Signal[] {
  return signals.filter(
    (signal) =>
      signal.review_status === "published" &&
      signal.published_at !== null &&
      signal.is_demo !== true,
  );
}

function publishedMetricsOnly(
  metrics: readonly MarketMetric[],
): MarketMetric[] {
  return metrics.filter(
    (metric) => metric.is_published === true && metric.is_demo !== true,
  );
}

function publishedTopicRecordsOnly(
  records: readonly ProvinceTopicRecordWithFields[],
): ProvinceTopicRecordWithFields[] {
  return records.filter(
    (record) =>
      record.review_status === "published" &&
      record.published_at !== null,
  );
}

function recordCellKey(regionId: string, topicId: ChinaMarketTopicId) {
  return `${regionId}:${topicId}`;
}

function latestRecordByCell(
  records: readonly ProvinceTopicRecordWithFields[],
) {
  const result = new Map<string, ProvinceTopicRecordWithFields>();
  for (const record of records) {
    const key = recordCellKey(record.region_id, record.topic_id);
    const current = result.get(key);
    if (
      !current ||
      new Date(record.published_at ?? 0).getTime() >
        new Date(current.published_at ?? 0).getTime()
    ) {
      result.set(key, record);
    }
  }
  return result;
}

function availableFieldCount(record?: ProvinceTopicRecordWithFields) {
  return (
    record?.fields.filter(
      (field) =>
        field.coverage_status === "available" &&
        Boolean(field.value_text?.trim()),
    ).length ?? 0
  );
}

function fieldForKey(
  record: ProvinceTopicRecordWithFields | undefined,
  fieldKey: string,
): ProvinceTopicField | undefined {
  return record?.fields.find((field) => field.field_key === fieldKey);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function recordCoverageState(
  record: ProvinceTopicRecordWithFields | undefined,
  expectedFieldCount: number,
) {
  if (!record) return "no_topic_data";
  return availableFieldCount(record) === expectedFieldCount
    ? "complete"
    : "partial";
}

export interface ChinaProvinceMarketAtlasProps {
  /** The regions table is the only province registry used by this component. */
  regions: readonly Region[];
  /** Optional explicit China country row id; recommended when integrating. */
  chinaRegionId?: string;
  /** Generic records remain separate and are shown only as supporting counts. */
  signals?: readonly Signal[];
  marketMetrics?: readonly MarketMetric[];
  /** Reviewed field-level records from the dedicated province-topic module. */
  provinceTopics?: readonly ProvinceTopicRecordWithFields[];
  /** Published CfD auction rows; overview charts only render for topic 08. */
  cfdAuctions?: readonly ChinaCfdAuction[];
  initialProvinceId?: string;
  initialTopicId?: ChinaMarketTopicId;
  className?: string;
  onProvinceChange?: (provinceId: string) => void;
  onTopicChange?: (topicId: ChinaMarketTopicId) => void;
}

/**
 * Read-only province/topic explorer. Values are sourced exclusively from the
 * dedicated published topic model; generic Signals and Metrics are never
 * inferred into topic facts.
 */
export function ChinaProvinceMarketAtlas({
  regions,
  chinaRegionId,
  signals = [],
  marketMetrics = [],
  provinceTopics = [],
  cfdAuctions = [],
  initialProvinceId,
  initialTopicId = "trading-rules",
  className,
  onProvinceChange,
  onTopicChange,
}: ChinaProvinceMarketAtlasProps) {
  const chinaRegion = findChinaRegion(regions, chinaRegionId);
  const provinces = useMemo(
    () =>
      chinaRegion
        ? regions
            .filter(
              (region) =>
                region.region_type === "province" &&
                region.parent_id === chinaRegion.id,
            )
            .sort((left, right) =>
              regionLabel(left).localeCompare(regionLabel(right), "zh-CN"),
            )
        : [],
    [chinaRegion, regions],
  );
  const publishedSignals = useMemo(
    () => publishedSignalsOnly(signals),
    [signals],
  );
  const publishedMetrics = useMemo(
    () => publishedMetricsOnly(marketMetrics),
    [marketMetrics],
  );
  const publishedTopicRecords = useMemo(
    () => publishedTopicRecordsOnly(provinceTopics),
    [provinceTopics],
  );
  const provinceIds = useMemo(
    () => new Set(provinces.map((province) => province.id)),
    [provinces],
  );
  const chinaSignals = publishedSignals.filter(
    (signal) => signal.region_id && provinceIds.has(signal.region_id),
  );
  const chinaMetrics = publishedMetrics.filter((metric) =>
    provinceIds.has(metric.region_id),
  );
  const chinaTopicRecords = publishedTopicRecords.filter((record) =>
    provinceIds.has(record.region_id),
  );
  const recordsByCell = useMemo(
    () => latestRecordByCell(chinaTopicRecords),
    [chinaTopicRecords],
  );

  const [activeProvinceId, setActiveProvinceId] = useState(
    initialProvinceId ?? "",
  );
  const [activeTopicId, setActiveTopicId] =
    useState<ChinaMarketTopicId>(initialTopicId);
  const [query, setQuery] = useState("");

  const activeTopic =
    CHINA_MARKET_TOPICS.find((topic) => topic.id === activeTopicId) ??
    CHINA_MARKET_TOPICS[0];
  const activeProvince =
    provinces.find((province) => province.id === activeProvinceId) ??
    provinces.find((province) => province.slug === "shandong") ??
    provinces[0];
  const activeRecord = activeProvince
    ? recordsByCell.get(recordCellKey(activeProvince.id, activeTopic.id))
    : undefined;

  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const filteredProvinces = provinces.filter((province) =>
    [province.name_zh, province.name_en, province.code, province.slug]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("zh-CN")
      .includes(normalizedQuery),
  );

  const activeProvinceSignals = activeProvince
    ? chinaSignals.filter((signal) => signal.region_id === activeProvince.id)
    : [];
  const activeProvinceMetrics = activeProvince
    ? chinaMetrics.filter((metric) => metric.region_id === activeProvince.id)
    : [];
  const activeProvinceCfdAuctions = activeProvince
    ? cfdAuctions.filter(
        (auction) => auction.region_id === activeProvince.id,
      )
    : [];
  const activeTopicRecords = provinces
    .map((province) =>
      recordsByCell.get(recordCellKey(province.id, activeTopic.id)),
    )
    .filter(
      (
        record,
      ): record is ProvinceTopicRecordWithFields => Boolean(record),
    );
  const activeTopicAvailableFields = activeTopicRecords.reduce(
    (total, record) => total + availableFieldCount(record),
    0,
  );
  const topicProvinceCoverage =
    provinces.length > 0
      ? Math.round((activeTopicRecords.length / provinces.length) * 100)
      : 0;
  const hasExpectedProvinceRegistry = provinces.length === 31;
  const activeCoverageState = recordCoverageState(
    activeRecord,
    activeTopic.fields.length,
  );

  function selectProvince(province: Region) {
    setActiveProvinceId(province.id);
    onProvinceChange?.(province.id);
  }

  function selectTopic(topic: TopicDefinition) {
    setActiveTopicId(topic.id);
    onTopicChange?.(topic.id);
  }

  function handleTopicKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % CHINA_MARKET_TOPICS.length;
    }
    if (event.key === "ArrowLeft") {
      nextIndex =
        (index - 1 + CHINA_MARKET_TOPICS.length) %
        CHINA_MARKET_TOPICS.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = CHINA_MARKET_TOPICS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const topic = CHINA_MARKET_TOPICS[nextIndex];
    selectTopic(topic);
    document.getElementById(`china-topic-${topic.id}`)?.focus();
  }

  if (!chinaRegion) {
    return (
      <section
        className={classNames(
          styles.atlas,
          styles.configurationState,
          className,
        )}
        aria-labelledby="china-market-atlas-title"
      >
        <div className={styles.configurationCard}>
          <span>REGION CONFIGURATION REQUIRED</span>
          <h2 id="china-market-atlas-title">未找到中国地区记录</h2>
          <p>
            请传入 regions 表数据并提供中国 country
            记录；组件不会在前端创建或猜测省份。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="china-market-atlas"
      className={classNames(styles.atlas, className)}
      aria-labelledby="china-market-atlas-title"
    >
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>
            China provincial intelligence / 中国省级台账
          </div>
          <h2 id="china-market-atlas-title">
            {provinces.length || "—"} 省级地区
            <br />
            <em>
              电力市场
              <br />
              专题矩阵
            </em>
          </h2>
          <p>
            八类专题按数据库中的省级专题记录分别展示。每个具体值都保留覆盖状态、原始单位和字段级证据定位。
          </p>
          <div
            className={styles.boundaryFlag}
            data-complete={hasExpectedProvinceRegistry}
          >
            <span aria-hidden="true" />
            {hasExpectedProvinceRegistry
              ? "REGIONS TABLE · 31 / 31"
              : `REGION CONFIG INCOMPLETE · ${provinces.length} / 31`}
          </div>
        </div>

        <aside className={styles.coverageCard} aria-label="已发布专题数据覆盖">
          <div className={styles.coverageTopline}>
            <span>PUBLISHED TOPIC COVERAGE</span>
            <strong>
              {activeTopic.index} /{" "}
              {String(CHINA_MARKET_TOPICS.length).padStart(2, "0")}
            </strong>
          </div>
          <div className={styles.coverageValue}>
            <strong>{topicProvinceCoverage}%</strong>
            <span>
              {activeTopicRecords.length} / {provinces.length} 省份有发布记录
            </span>
          </div>
          <div className={styles.coverageTrack} aria-hidden="true">
            <span style={{ width: `${topicProvinceCoverage}%` }} />
          </div>
          <dl className={styles.coverageMeta}>
            <div>
              <dt>Topic records</dt>
              <dd>{activeTopicRecords.length} 个发布单元</dd>
            </div>
            <div>
              <dt>Available fields</dt>
              <dd>{activeTopicAvailableFields} 个有值字段</dd>
            </div>
            <div>
              <dt>Province rows</dt>
              <dd>{provinces.length} 条地区记录</dd>
            </div>
          </dl>
          <p className={styles.coverageRule}>
            覆盖率按当前专题有无已发布记录计算；“未公布”“不适用”“来源冲突”仍作为明确覆盖状态展示，不会转成
            0。
          </p>
        </aside>
      </header>

      <div className={styles.topicRail}>
        <div className={styles.railLabel}>
          <span>Topic ledger</span>
          <strong>八类专题</strong>
        </div>
        <div
          className={styles.topicTabs}
          role="tablist"
          aria-label="中国电力市场专题"
        >
          {CHINA_MARKET_TOPICS.map((topic, index) => {
            const selected = topic.id === activeTopic.id;
            return (
              <button
                type="button"
                role="tab"
                id={`china-topic-${topic.id}`}
                aria-selected={selected}
                aria-controls="china-topic-panel"
                tabIndex={selected ? 0 : -1}
                className={classNames(
                  styles.topicTab,
                  selected && styles.topicTabActive,
                )}
                onClick={() => selectTopic(topic)}
                onKeyDown={(event) => handleTopicKeyDown(event, index)}
                key={topic.id}
              >
                <span>{topic.index}</span>
                <strong>{topic.shortLabel}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={styles.topicIntro}
        role="tabpanel"
        id="china-topic-panel"
        aria-labelledby={`china-topic-${activeTopic.id}`}
      >
        <div>
          <span>{activeTopic.index} / TOPIC</span>
          <h3>{activeTopic.title}</h3>
        </div>
        <p>{activeTopic.description}</p>
      </div>

      {activeTopic.id === "renewable-mechanism-price" && cfdAuctions.length ? (
        <ChinaCfdOverviewDashboard
          auctions={cfdAuctions}
          onProvinceSelect={(regionId) => {
            const province = provinces.find((item) => item.id === regionId);
            if (!province) return;
            selectProvince(province);
            requestAnimationFrame(() => {
              document
                .getElementById("china-province-detail")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }}
        />
      ) : null}

      <div className={styles.workspace}>
        <section
          className={styles.provincePanel}
          aria-labelledby="province-directory-title"
        >
          <div className={styles.panelHeader}>
            <div>
              <span>Province directory</span>
              <h3 id="province-directory-title">省份索引</h3>
            </div>
            <span className={styles.resultCount} aria-live="polite">
              {filteredProvinces.length} / {provinces.length}
            </span>
          </div>

          <label className={styles.searchBox}>
            <span className={styles.srOnly}>搜索省份</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索省份、代码或 slug…"
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="清除省份搜索"
              >
                ×
              </button>
            ) : null}
          </label>

          {filteredProvinces.length ? (
            <div className={styles.provinceGrid} aria-label="中国省级地区">
              {filteredProvinces.map((province) => {
                const selected = province.id === activeProvince?.id;
                const record = recordsByCell.get(
                  recordCellKey(province.id, activeTopic.id),
                );
                const availabilityState = recordCoverageState(
                  record,
                  activeTopic.fields.length,
                );
                const fieldCount = availableFieldCount(record);
                const statusText = record
                  ? `${fieldCount}/${activeTopic.fields.length} 个字段有已核实值`
                  : "暂无已发布专题记录";
                return (
                  <button
                    type="button"
                    className={classNames(
                      styles.provinceButton,
                      selected && styles.provinceButtonActive,
                    )}
                    data-state={availabilityState}
                    aria-pressed={selected}
                    aria-label={`${regionLabel(province)}，${statusText}`}
                    onClick={() => selectProvince(province)}
                    key={province.id}
                  >
                    <span className={styles.provinceShort}>
                      {regionMonogram(province)}
                    </span>
                    <span className={styles.provinceName}>
                      {regionLabel(province)}
                    </span>
                    <i aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.noResults}>没有匹配的省级地区。</div>
          )}

          <div className={styles.statusLegend} aria-label="专题覆盖状态图例">
            <span data-state="complete">
              <i aria-hidden="true" /> 字段完整
            </span>
            <span data-state="partial">
              <i aria-hidden="true" /> 已发布但不完整
            </span>
            <span data-state="no_topic_data">
              <i aria-hidden="true" /> 暂无发布记录
            </span>
          </div>
        </section>

        {activeProvince ? (
          <article
            id="china-province-detail"
            className={styles.detailPanel}
            aria-live="polite"
          >
            <header className={styles.detailHeader}>
              <div className={styles.provinceMonogram} aria-hidden="true">
                {regionMonogram(activeProvince)}
              </div>
              <div className={styles.detailTitle}>
                <span>
                  {activeProvince.code || activeProvince.slug} /{" "}
                  {activeTopic.index}
                </span>
                <h3>{regionLabel(activeProvince)}</h3>
                <p>{activeTopic.title}</p>
              </div>
              <span
                className={styles.detailStatus}
                data-state={activeCoverageState}
              >
                {activeRecord
                  ? activeCoverageState === "complete"
                    ? "字段完整"
                    : `${availableFieldCount(activeRecord)} / ${activeTopic.fields.length} 有值`
                  : "暂无已发布专题数据"}
              </span>
            </header>

            {activeRecord?.is_demo ? (
              <div className={styles.demoNotice}>
                DEMO · 此专题记录仅用于工程验证，不代表真实市场结论
              </div>
            ) : null}

            {activeTopic.id === "renewable-mechanism-price" ? (
              <ChinaProvinceCfdDossier auctions={activeProvinceCfdAuctions} />
            ) : null}

            <div className={styles.fieldGrid}>
              {activeTopic.fields.map((definition) => {
                const field = fieldForKey(activeRecord, definition.key);
                const derived =
                  activeTopic.id === "renewable-mechanism-price" &&
                  !field?.value_text?.trim()
                    ? deriveMechanismFieldValue(
                        definition.key,
                        activeProvinceCfdAuctions,
                      )
                    : null;
                const state = field?.coverage_status ??
                  (derived ? "partial" : "no_topic_data");
                const statusLabel = field
                  ? PROVINCE_TOPIC_FIELD_COVERAGE_LABELS[
                      field.coverage_status
                    ]
                  : derived
                    ? "竞价库自动拆解"
                    : "暂无已发布数据";
                const displayText = field?.value_text?.trim()
                  ? field.value_text
                  : derived?.text;
                const displayUnit = field?.value_text?.trim()
                  ? field?.unit
                  : derived?.unit;
                const displaySourceUrl = field?.source_url ?? derived?.sourceUrl;
                const displaySourceName = field?.source_url
                  ? field.source_name || "查看字段来源"
                  : derived?.sourceUrl
                    ? "查看来源（竞价库）"
                    : null;
                const hasValue = Boolean(displayText?.trim());
                return (
                  <section
                    className={styles.fieldCard}
                    data-state={state}
                    key={definition.key}
                  >
                    <div className={styles.fieldTopline}>
                      <span>{definition.valueKind}</span>
                      <strong data-state={state}>{statusLabel}</strong>
                    </div>
                    <h4>{definition.label}</h4>
                    <p>{definition.description}</p>
                    <div
                      className={styles.fieldValue}
                      data-empty={!hasValue}
                    >
                      <strong>{hasValue ? displayText : "—"}</strong>
                      {hasValue && displayUnit ? (
                        <small>{displayUnit}</small>
                      ) : null}
                    </div>
                    {field?.applicability || field?.source_locator ? (
                      <dl className={styles.fieldEvidence}>
                        {field.applicability ? (
                          <div>
                            <dt>适用范围</dt>
                            <dd>{field.applicability}</dd>
                          </div>
                        ) : null}
                        {field.source_locator ? (
                          <div>
                            <dt>证据定位</dt>
                            <dd>{field.source_locator}</dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                    <div className={styles.sourceRow}>
                      {displaySourceUrl ? (
                        <a
                          href={displaySourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {displaySourceName} ↗
                        </a>
                      ) : (
                        <span>尚无字段级公开来源</span>
                      )}
                      <time>{formatDate(activeRecord?.as_of_date)}</time>
                    </div>
                  </section>
                );
              })}
            </div>

            <footer className={styles.detailFooter}>
              {activeRecord ? (
                <>
                  <div>
                    <span>当前发布记录</span>
                    <strong>{activeRecord.title || activeTopic.title}</strong>
                  </div>
                  <p>
                    文件状态：
                    {activeRecord.legal_status
                      ? PROVINCE_TOPIC_LEGAL_STATUS_LABELS[
                          activeRecord.legal_status
                        ]
                      : "—"}
                    {activeRecord.operational_status
                      ? ` · 运行状态：${
                          PROVINCE_TOPIC_OPERATIONAL_STATUS_LABELS[
                            activeRecord.operational_status
                          ]
                        }`
                      : ""}
                    {` · 核验截至 ${formatDate(activeRecord.as_of_date)}`}
                  </p>
                  {activeRecord.source_url ? (
                    <a
                      className={styles.recordSourceLink}
                      href={activeRecord.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {activeRecord.source_name || "查看主来源"} ↗
                    </a>
                  ) : null}
                </>
              ) : (
                <>
                  <div>
                    <span>通用已发布记录（非专题结论）</span>
                    <strong>
                      {activeProvinceSignals.length} Signals ·{" "}
                      {activeProvinceMetrics.length} Metrics
                    </strong>
                  </div>
                  <p>
                    这些通用记录不能自动证明当前专题字段。请由管理员在“省级专题”模块建立字段值、覆盖状态和证据后发布。
                  </p>
                </>
              )}
            </footer>
          </article>
        ) : (
          <div className={styles.noProvinceState}>
            <strong>暂无省级地区</strong>
            <p>请先在 regions 表中建立 parent_id 指向中国的 province 记录。</p>
          </div>
        )}
      </div>

      <footer className={styles.methodology}>
        <span>Availability protocol</span>
        <p>
          省份身份来自 regions 表；专题值只来自
          china_province_topic_records / fields
          中已发布的最新记录。缺失值以明确覆盖状态和“—”展示，真实数值 0
          保持为 0；通用 Signal / Metric 不参与专题字段推断。
        </p>
      </footer>
    </section>
  );
}
