"use client";

import { useMemo, useState } from "react";

import type { ChinaCfdAuction } from "@/lib/types";
import { localizeCfdNote } from "@/lib/china-market/cfd-localize";

import styles from "./ChinaCfdAuctionTable.module.css";

const GRID_REGION_ORDER = ["华北", "东北", "西北", "华中", "华东", "南方"];
const ALL = "all";
const UNSET = "__unset__";

function regionOrder(region: string | null) {
  const index = region ? GRID_REGION_ORDER.indexOf(region) : -1;
  return index === -1 ? GRID_REGION_ORDER.length : index;
}

function num(value: number | null, digits = 1) {
  if (value == null) return "—";
  const rounded =
    Math.abs(value) >= 1000
      ? Math.round(value).toLocaleString("zh-CN")
      : Number(value.toFixed(digits)).toString();
  return rounded;
}

function percent(value: number | null) {
  return value == null ? "—" : `${Number(value.toFixed(1))}%`;
}

function durationLabel(auction: ChinaCfdAuction) {
  const parts: string[] = [];
  const { duration_years_onshore, duration_years_offshore, duration_years_solar } =
    auction;
  const values = [
    duration_years_onshore,
    duration_years_offshore,
    duration_years_solar,
  ].filter((value): value is number => value != null);
  if (!values.length) return "—";
  if (new Set(values).size === 1) return String(values[0]);
  if (duration_years_onshore != null) parts.push(`风${duration_years_onshore}`);
  if (duration_years_offshore != null) {
    parts.push(`海风${duration_years_offshore}`);
  }
  if (duration_years_solar != null) parts.push(`光${duration_years_solar}`);
  return parts.join(" / ");
}

function uniqueSortedStrings(values: Array<string | null | undefined>) {
  const set = new Set<string>();
  let hasUnset = false;
  for (const value of values) {
    const text = value?.trim();
    if (!text) {
      hasUnset = true;
      continue;
    }
    set.add(text);
  }
  const sorted = [...set].sort((left, right) =>
    left.localeCompare(right, "zh-CN"),
  );
  return { values: sorted, hasUnset };
}

function sortAuctions(auctions: readonly ChinaCfdAuction[]) {
  return [...auctions].sort((left, right) => {
    const region = regionOrder(left.grid_region) - regionOrder(right.grid_region);
    if (region !== 0) return region;
    const label = left.province_label.localeCompare(
      right.province_label,
      "zh-CN",
    );
    if (label !== 0) return label;
    const year = (left.delivery_year ?? 9999) - (right.delivery_year ?? 9999);
    if (year !== 0) return year;
    return (left.auction_round ?? "").localeCompare(
      right.auction_round ?? "",
      "zh-CN",
    );
  });
}

export function ChinaCfdAuctionTable({
  auctions,
  className,
}: {
  auctions: readonly ChinaCfdAuction[];
  className?: string;
}) {
  const years = useMemo(() => {
    const set = new Set<number>();
    let hasUnset = false;
    for (const auction of auctions) {
      if (auction.delivery_year == null) hasUnset = true;
      else set.add(auction.delivery_year);
    }
    return {
      values: [...set].sort((left, right) => right - left),
      hasUnset,
    };
  }, [auctions]);

  const rounds = useMemo(
    () => uniqueSortedStrings(auctions.map((auction) => auction.auction_round)),
    [auctions],
  );
  const statuses = useMemo(
    () => uniqueSortedStrings(auctions.map((auction) => auction.status)),
    [auctions],
  );
  const regions = useMemo(
    () =>
      uniqueSortedStrings(auctions.map((auction) => auction.grid_region)).values
        .sort(
          (left, right) => regionOrder(left) - regionOrder(right),
        ),
    [auctions],
  );

  const latestYear = years.values[0];
  const [yearFilter, setYearFilter] = useState(
    latestYear != null ? String(latestYear) : ALL,
  );
  const [roundFilter, setRoundFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [regionFilter, setRegionFilter] = useState(ALL);

  const filtered = useMemo(() => {
    return auctions.filter((auction) => {
      if (yearFilter !== ALL) {
        if (yearFilter === UNSET) {
          if (auction.delivery_year != null) return false;
        } else if (String(auction.delivery_year ?? "") !== yearFilter) {
          return false;
        }
      }
      if (roundFilter !== ALL) {
        if (roundFilter === UNSET) {
          if (auction.auction_round?.trim()) return false;
        } else if (auction.auction_round !== roundFilter) {
          return false;
        }
      }
      if (statusFilter !== ALL) {
        if (statusFilter === UNSET) {
          if (auction.status?.trim()) return false;
        } else if (auction.status !== statusFilter) {
          return false;
        }
      }
      if (regionFilter !== ALL) {
        if (auction.grid_region !== regionFilter) return false;
      }
      return true;
    });
  }, [auctions, yearFilter, roundFilter, statusFilter, regionFilter]);

  const sorted = useMemo(() => sortAuctions(filtered), [filtered]);

  const filtersActive =
    yearFilter !== ALL ||
    roundFilter !== ALL ||
    statusFilter !== ALL ||
    regionFilter !== ALL;

  if (!auctions.length) return null;

  return (
    <section
      id="china-cfd-auctions"
      className={`${styles.wrapper}${className ? ` ${className}` : ""}`}
      aria-labelledby="china-cfd-auctions-title"
    >
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            CfD auction ledger / 风光机制电价竞价总表
          </div>
          <h2 id="china-cfd-auctions-title">
            136号文 机制电价<em>竞价总表</em>
          </h2>
          <p>
            按“省级电网区域 × 竞价轮次”展示各省风光机制电价（差价合约）竞价条款与结果。
            可用下方筛选聚焦交付年、轮次或状态；空值表示未公布，不代表数值为 0。
          </p>
        </div>
      </header>

      <div className={styles.toolbar} role="group" aria-label="竞价总表筛选">
        <label>
          <span>交付年</span>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
          >
            <option value={ALL}>全部</option>
            {years.values.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
            {years.hasUnset ? <option value={UNSET}>未标注</option> : null}
          </select>
        </label>
        <label>
          <span>轮次</span>
          <select
            value={roundFilter}
            onChange={(event) => setRoundFilter(event.target.value)}
          >
            <option value={ALL}>全部</option>
            {rounds.values.map((round) => (
              <option key={round} value={round}>
                {round}
              </option>
            ))}
            {rounds.hasUnset ? <option value={UNSET}>未标注</option> : null}
          </select>
        </label>
        <label>
          <span>状态</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value={ALL}>全部</option>
            {statuses.values.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
            {statuses.hasUnset ? <option value={UNSET}>未标注</option> : null}
          </select>
        </label>
        <label>
          <span>区域</span>
          <select
            value={regionFilter}
            onChange={(event) => setRegionFilter(event.target.value)}
          >
            <option value={ALL}>全部</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.toolbarMeta}>
          <span>
            显示 {sorted.length} / {auctions.length} 条
          </span>
          <button
            type="button"
            className={styles.resetButton}
            disabled={!filtersActive}
            onClick={() => {
              setYearFilter(ALL);
              setRoundFilter(ALL);
              setStatusFilter(ALL);
              setRegionFilter(ALL);
            }}
          >
            重置
          </button>
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th rowSpan={2}>区域</th>
              <th rowSpan={2}>省份 / 电网</th>
              <th rowSpan={2}>轮次</th>
              <th rowSpan={2}>公告日期</th>
              <th rowSpan={2}>交付年</th>
              <th rowSpan={2}>状态</th>
              <th colSpan={3}>陆上风电 元/MWh</th>
              <th colSpan={3}>海上风电 元/MWh</th>
              <th colSpan={3}>光伏 元/MWh</th>
              <th rowSpan={2}>
                煤电基准
                <br />
                元/MWh
              </th>
              <th colSpan={3}>机制电量 GWh</th>
              <th rowSpan={2}>
                期限
                <br />年
              </th>
              <th rowSpan={2}>结果公告</th>
              <th rowSpan={2}>省级政策</th>
            </tr>
            <tr>
              <th>下限</th>
              <th>上限</th>
              <th>出清</th>
              <th>下限</th>
              <th>上限</th>
              <th>出清</th>
              <th>下限</th>
              <th>上限</th>
              <th>出清</th>
              <th>目标</th>
              <th>中标</th>
              <th>认购率</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length ? (
              sorted.map((auction, index) => {
                const showRegion =
                  index === 0 ||
                  sorted[index - 1].grid_region !== auction.grid_region;
                return (
                  <tr key={auction.id}>
                    <td className={styles.regionCell}>
                      {showRegion ? auction.grid_region ?? "—" : ""}
                    </td>
                    <td className={styles.provinceCell}>
                      <strong>{auction.province_label}</strong>
                      {auction.is_demo ? (
                        <span className={styles.demoTag}>DEMO</span>
                      ) : null}
                    </td>
                    <td>{auction.auction_round ?? "—"}</td>
                    <td className={styles.dateCell}>
                      {auction.announcement_date ?? "—"}
                    </td>
                    <td>{auction.delivery_year ?? "—"}</td>
                    <td>
                      <span
                        className={styles.status}
                        data-completed={auction.status === "已完成"}
                      >
                        {auction.status ?? "—"}
                      </span>
                    </td>
                    <td>{num(auction.onshore_wind_floor)}</td>
                    <td>{num(auction.onshore_wind_cap)}</td>
                    <td className={styles.strike}>
                      {num(auction.onshore_wind_strike)}
                    </td>
                    <td>{num(auction.offshore_wind_floor)}</td>
                    <td>{num(auction.offshore_wind_cap)}</td>
                    <td className={styles.strike}>
                      {num(auction.offshore_wind_strike)}
                    </td>
                    <td>{num(auction.solar_floor)}</td>
                    <td>{num(auction.solar_cap)}</td>
                    <td className={styles.strike}>
                      {num(auction.solar_strike)}
                    </td>
                    <td>{num(auction.coal_benchmark)}</td>
                    <td>{num(auction.target_volume_gwh, 0)}</td>
                    <td>{num(auction.awarded_volume_gwh, 0)}</td>
                    <td>{percent(auction.subscription_rate)}</td>
                    <td>{durationLabel(auction)}</td>
                    <td>
                      {auction.source_url ? (
                        <a
                          href={auction.source_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          title={
                            localizeCfdNote(auction.note) ??
                            auction.source_name ??
                            undefined
                          }
                        >
                          结果 ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {auction.implementation_plan_url ? (
                        <a
                          href={auction.implementation_plan_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          title={auction.implementation_plan_name ?? undefined}
                        >
                          {auction.implementation_plan_name ?? "实施方案"} ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className={styles.emptyCell} colSpan={22}>
                  当前筛选条件下没有竞价记录，可重置筛选查看全部。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className={styles.footnote}>
        价格为竞价公告或结果原文数值（元/MWh）；“出清”为竞价形成的机制电价。目标
        / 中标电量为风光合计（GWh）。
        期限为机制执行年限，风光不同则分别标注。空值表示官方未公布该项，真实数值
        0 保持为 0。默认优先展示最新交付年，可切换为全部轮次对比。
      </p>
    </section>
  );
}
