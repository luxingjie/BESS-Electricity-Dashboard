"use client";

import { useMemo, useState } from "react";

import type { AnalyticsBucket, BessProjectAnalytics } from "@/lib/bess-projects/analytics";
import {
  normalizeDurationBuckets,
  padMonthBuckets,
} from "@/lib/bess-projects/analytics";
import type { PeriodMode } from "@/lib/bess-projects/period";
import type { BessProjectEventType } from "@/lib/types";

export type AnalyticsUnit = "gw" | "gwh";

const ANALYTICS_TRACKS: Array<{ id: BessProjectEventType; label: string }> = [
  { id: "tender", label: "招标" },
  { id: "award", label: "中标" },
  { id: "commissioning", label: "并网" },
];

function bucketValue(bucket: AnalyticsBucket, unit: AnalyticsUnit): number {
  const raw = unit === "gw" ? bucket.power_mw : bucket.energy_mwh;
  if (raw == null || !Number.isFinite(raw)) return 0;
  return raw / 1000;
}

function formatUnitValue(value: number, unit: AnalyticsUnit): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(2);
}

function formatUnitLabel(value: number, unit: AnalyticsUnit): string {
  const suffix = unit === "gw" ? "GW" : "GWh";
  return `${formatUnitValue(value, unit)} ${suffix}`;
}

function shortMonthLabel(key: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return key;
  return `${Number(match[2])}月`;
}

function BarChart({
  title,
  subtitle,
  buckets,
  unit,
  orientation = "vertical",
  sortByValue = false,
}: {
  title: string;
  subtitle?: string;
  buckets: AnalyticsBucket[];
  unit: AnalyticsUnit;
  orientation?: "vertical" | "horizontal";
  sortByValue?: boolean;
}) {
  const rows = useMemo(() => {
    const mapped = buckets.map((bucket) => ({
      bucket,
      value: bucketValue(bucket, unit),
    }));
    if (!sortByValue) return mapped;
    const other = mapped.filter((row) => row.bucket.key === "__other__");
    const rest = mapped
      .filter((row) => row.bucket.key !== "__other__")
      .sort(
        (a, b) =>
          b.value - a.value ||
          a.bucket.label.localeCompare(b.bucket.label, "zh-CN"),
      );
    return [...rest, ...other];
  }, [buckets, unit, sortByValue]);

  const max = Math.max(1, ...rows.map((row) => row.value));
  const unitSuffix = unit === "gw" ? "GW" : "GWh";

  return (
    <article className="gl-projects-chart">
      <header>
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </header>
      {!rows.length ? (
        <div className="gl-projects-chart-empty">暂无数据</div>
      ) : orientation === "horizontal" ? (
        <ul className="gl-projects-hbar">
          {rows.map(({ bucket, value }) => (
            <li
              key={bucket.key}
              title={`${bucket.label}：${formatUnitLabel(value, unit)} · ${bucket.count} 条`}
            >
              <span className="gl-projects-hbar-label">{bucket.label}</span>
              <span className="gl-projects-hbar-track">
                <i style={{ width: `${(value / max) * 100}%` }} />
              </span>
              <span className="gl-projects-hbar-value">
                {formatUnitValue(value, unit)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div
          className="gl-projects-vbar"
          role="img"
          aria-label={`${title}（${unitSuffix}）`}
        >
          {rows.map(({ bucket, value }) => (
            <div
              key={bucket.key}
              className="gl-projects-vbar-col"
              title={`${bucket.label}：${formatUnitLabel(value, unit)} · ${bucket.count} 条`}
            >
              <span className="gl-projects-vbar-value">
                {formatUnitValue(value, unit)}
              </span>
              <span className="gl-projects-vbar-track">
                <i style={{ height: `${(value / max) * 100}%` }} />
              </span>
              <span className="gl-projects-vbar-label">{bucket.label}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function ProjectsAnalyticsCharts({
  analytics,
  loading,
  dateFrom,
  dateTo,
  periodLabel,
  periodMode,
  analyticsTrack,
  customFrom,
  customTo,
  onAnalyticsTrackChange,
  onPeriodModeChange,
  onCustomFromChange,
  onCustomToChange,
}: {
  analytics: BessProjectAnalytics | null;
  loading?: boolean;
  dateFrom?: string;
  dateTo?: string;
  periodLabel?: string;
  periodMode: PeriodMode;
  analyticsTrack: BessProjectEventType;
  customFrom: string;
  customTo: string;
  onAnalyticsTrackChange: (track: BessProjectEventType) => void;
  onPeriodModeChange: (mode: PeriodMode) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
}) {
  const [unit, setUnit] = useState<AnalyticsUnit>("gw");

  const monthBuckets = useMemo(
    () =>
      padMonthBuckets(analytics?.by_month ?? [], dateFrom, dateTo).map(
        (bucket) => ({
          ...bucket,
          label: shortMonthLabel(bucket.key),
        }),
      ),
    [analytics?.by_month, dateFrom, dateTo],
  );

  const durationBuckets = useMemo(
    () => normalizeDurationBuckets(analytics?.by_duration ?? []),
    [analytics?.by_duration],
  );

  const totals = useMemo(() => {
    const buckets = analytics?.by_month ?? [];
    const sum = buckets.reduce(
      (acc, bucket) => acc + bucketValue(bucket, unit),
      0,
    );
    return formatUnitLabel(sum, unit);
  }, [analytics?.by_month, unit]);

  return (
    <section className="gl-projects-analytics" aria-label="项目分析">
      <div className="gl-projects-analytics-head">
        <div className="gl-projects-analytics-title">
          <div className="gl-section-kicker">Analytics</div>
          <h3>结构速览</h3>
          <p className="gl-projects-analytics-summary">
            {loading
              ? "统计更新中…"
              : analytics
                ? `样本 ${analytics.sample_size} 条 · 合计 ${totals}${periodLabel ? ` · ${periodLabel}` : ""}`
                : "暂无统计"}
          </p>
        </div>
        <div className="gl-projects-analytics-meta">
          <div className="gl-projects-analytics-controls">
            <div className="gl-projects-analytics-control">
              <span className="gl-projects-analytics-control-label">期间</span>
              <div className="gl-mode-switch" role="tablist" aria-label="分析期间">
                <button
                  type="button"
                  role="tab"
                  aria-selected={periodMode === "year"}
                  className={periodMode === "year" ? "is-active" : undefined}
                  onClick={() => onPeriodModeChange("year")}
                >
                  按年
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={periodMode === "custom"}
                  className={periodMode === "custom" ? "is-active" : undefined}
                  onClick={() => onPeriodModeChange("custom")}
                >
                  自定义
                </button>
              </div>
            </div>
            <div className="gl-projects-analytics-control">
              <span className="gl-projects-analytics-control-label">轨道</span>
              <div
                className="gl-mode-switch"
                role="tablist"
                aria-label="分析轨道"
              >
                {ANALYTICS_TRACKS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={analyticsTrack === item.id}
                    className={
                      analyticsTrack === item.id ? "is-active" : undefined
                    }
                    onClick={() => onAnalyticsTrackChange(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="gl-projects-analytics-filter">
              <span>单位</span>
              <select
                value={unit}
                aria-label="数据单位"
                onChange={(event) =>
                  setUnit(event.target.value as AnalyticsUnit)
                }
              >
                <option value="gw">GW</option>
                <option value="gwh">GWh</option>
              </select>
            </label>
          </div>
          {periodMode === "custom" ? (
            <div className="gl-projects-analytics-dates">
              <label>
                <span className="gl-sr-only">开始日期</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => onCustomFromChange(event.target.value)}
                />
              </label>
              <span className="gl-projects-period-sep">至</span>
              <label>
                <span className="gl-sr-only">结束日期</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => onCustomToChange(event.target.value)}
                />
              </label>
            </div>
          ) : null}
        </div>
      </div>
      <div className="gl-projects-analytics-grid">
        <BarChart
          title="按月份"
          subtitle={
            dateFrom && dateTo
              ? `区间内按月可比 · ${unit === "gw" ? "GW" : "GWh"}`
              : undefined
          }
          buckets={monthBuckets}
          unit={unit}
        />
        <BarChart
          title="按省份"
          subtitle="Top 10 + 其他"
          buckets={analytics?.by_province ?? []}
          unit={unit}
          orientation="horizontal"
          sortByValue
        />
        <BarChart
          title="按场景"
          subtitle="发电侧 / 电网侧 / 用户侧"
          buckets={analytics?.by_scene ?? []}
          unit={unit}
        />
        <BarChart
          title="按时长"
          subtitle="储能时长区间"
          buckets={durationBuckets}
          unit={unit}
        />
        <BarChart
          title="按招中标类型"
          subtitle="EPC / 储能系统 / 电芯"
          buckets={analytics?.by_scope ?? []}
          unit={unit}
        />
      </div>
    </section>
  );
}
