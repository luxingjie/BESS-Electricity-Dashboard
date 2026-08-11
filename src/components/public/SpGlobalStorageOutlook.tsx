"use client";

import { useMemo, useState } from "react";

import {
  SP_GLOBAL_STORAGE_OUTLOOK,
  SP_OUTLOOK_DEFAULT_YEAR,
  SP_OUTLOOK_REGION_COLORS,
  formatSpCapacity,
  spOutlookRowsForUnit,
  toDisplayCapacity,
  type SpOutlookUnit,
} from "@/lib/market/sp-global-outlook";

export function SpGlobalStorageOutlook() {
  const [unit, setUnit] = useState<SpOutlookUnit>("gw");
  const [year, setYear] = useState(SP_OUTLOOK_DEFAULT_YEAR);

  const rows = useMemo(() => spOutlookRowsForUnit(unit), [unit]);
  const unitLabel = unit === "gw" ? "GW" : "GWh";
  const regions = SP_GLOBAL_STORAGE_OUTLOOK.regions;

  const stackedYears = useMemo(() => {
    return SP_GLOBAL_STORAGE_OUTLOOK.years.map((y) => {
      const segments = regions.map((region) => {
        const raw =
          rows.find(
            (row) => row.year === y && row.region_en === region.key,
          )?.value ?? 0;
        return {
          key: region.key,
          label: region.label_zh,
          value: toDisplayCapacity(raw),
          color: SP_OUTLOOK_REGION_COLORS[region.key] ?? "#7a807b",
        };
      });
      const total = segments.reduce((sum, segment) => sum + segment.value, 0);
      return { year: y, segments, total };
    });
  }, [rows, regions]);

  const regionDetail = useMemo(() => {
    const selected =
      stackedYears.find((point) => point.year === year)?.segments ?? [];
    return [...selected].sort((a, b) => b.value - a.value);
  }, [stackedYears, year]);

  const yearTotal =
    stackedYears.find((point) => point.year === year)?.total ?? 0;
  const maxTrend = Math.max(1, ...stackedYears.map((point) => point.total));
  const maxRegion = Math.max(1, ...regionDetail.map((row) => row.value));

  return (
    <section className="gl-sp-outlook" aria-label="标普全球储能新增装机展望">
      <div className="gl-sp-outlook-head">
        <div>
          <div className="gl-section-kicker">Third-party outlook</div>
          <h3>全球储能新增装机展望</h3>
          <p className="gl-sp-outlook-summary">
            已选 <strong>{year}</strong> 年 · 全球合计{" "}
            <strong>
              {formatSpCapacity(yearTotal)} {unitLabel}
            </strong>
            {" · "}点击年份柱查看大区明细
          </p>
        </div>
      </div>

      <div className="gl-sp-outlook-stack">
        <article className="gl-sp-outlook-chart gl-sp-outlook-chart-trend">
          <header className="gl-sp-outlook-chart-head">
            <div>
              <strong>全球储能新增装机趋势</strong>
              <span>点击年份 · 2020–2035 · {unitLabel}</span>
            </div>
            <label className="gl-sp-outlook-filter">
              <span>单位</span>
              <select
                value={unit}
                aria-label="展望单位"
                onChange={(event) =>
                  setUnit(event.target.value as SpOutlookUnit)
                }
              >
                <option value="gw">GW</option>
                <option value="gwh">GWh</option>
              </select>
            </label>
          </header>

          <ul className="gl-sp-outlook-legend" aria-label="大区图例">
            {regions.map((region) => (
              <li key={region.key}>
                <i
                  style={{
                    background:
                      SP_OUTLOOK_REGION_COLORS[region.key] ?? "#7a807b",
                  }}
                />
                <span>{region.label_zh}</span>
              </li>
            ))}
          </ul>

          <div
            className="gl-sp-outlook-stacked"
            role="tablist"
            aria-label={`选择展望年份（${unitLabel}）`}
          >
            {stackedYears.map((point) => {
              const active = point.year === year;
              return (
                <button
                  type="button"
                  key={point.year}
                  role="tab"
                  aria-selected={active}
                  className={`gl-sp-outlook-year-col ${active ? "is-active" : ""}`}
                  title={`${point.year}：${formatSpCapacity(point.total)} ${unitLabel}`}
                  onClick={() => setYear(point.year)}
                >
                  <span className="gl-sp-outlook-year-track">
                    <span
                      className="gl-sp-outlook-year-stack"
                      style={{
                        height: `${(point.total / maxTrend) * 100}%`,
                      }}
                    >
                      <span className="gl-sp-outlook-year-value">
                        {formatSpCapacity(point.total)}
                      </span>
                      {point.segments.map((segment) => (
                        <i
                          key={segment.key}
                          style={{
                            flexGrow: Math.max(segment.value, 0.0001),
                            background: segment.color,
                          }}
                          title={`${segment.label}：${formatSpCapacity(segment.value)} ${unitLabel}`}
                        />
                      ))}
                    </span>
                  </span>
                  <span className="gl-sp-outlook-year-label">{point.year}</span>
                </button>
              );
            })}
          </div>
        </article>

        <article
          className="gl-sp-outlook-chart gl-sp-outlook-chart-detail"
          aria-live="polite"
        >
          <header>
            <strong>{year} 年大区明细</strong>
            <span>
              {formatSpCapacity(yearTotal)} {unitLabel}
            </span>
          </header>
          <ul className="gl-projects-hbar">
            {regionDetail.map((bucket) => (
              <li
                key={bucket.key}
                title={`${bucket.label}：${formatSpCapacity(bucket.value)} ${unitLabel}`}
              >
                <span className="gl-projects-hbar-label">
                  <i
                    className="gl-sp-outlook-swatch"
                    style={{ background: bucket.color }}
                  />
                  {bucket.label}
                </span>
                <span className="gl-projects-hbar-track">
                  <i
                    style={{
                      width: `${(bucket.value / maxRegion) * 100}%`,
                      background: bucket.color,
                    }}
                  />
                </span>
                <span className="gl-projects-hbar-value">
                  {formatSpCapacity(bucket.value)}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <footer className="gl-sp-outlook-footnotes">
          <div className="gl-sp-outlook-source">
            <span className="gl-sp-outlook-source-badge">数据来源</span>
            <div>
              <span className="gl-sp-outlook-source-tip" tabIndex={0}>
                <strong>{SP_GLOBAL_STORAGE_OUTLOOK.source_name}</strong>
                <em className="gl-sp-outlook-tip-bubble" role="tooltip">
                  地域为标普 Major region 口径（亚太 / 北美 / 欧盟27 / 非欧盟欧洲 /
                  拉美 / 中东 / 非洲），与本站六大区域及国家树相互独立，不做映射联动。
                </em>
              </span>
              <span>
                {SP_GLOBAL_STORAGE_OUTLOOK.source_product} ·{" "}
                {SP_GLOBAL_STORAGE_OUTLOOK.vintage}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
}
