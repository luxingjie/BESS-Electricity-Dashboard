import type { ChinaCfdAuction } from "@/lib/types";

import styles from "./ChinaCfdOverviewDashboard.module.css";

type ProvinceStrike = {
  regionId: string;
  label: string;
  wind: number | null;
  solar: number | null;
  coal: number | null;
  deliveryYear: number | null;
};

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function formatNumber(value: number | null, digits = 0) {
  if (value == null) return "—";
  return value.toLocaleString("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(digits, 1) : 0,
  });
}

function formatGwh(value: number | null) {
  if (value == null) return "—";
  if (value >= 10000) return `${(value / 1000).toFixed(0)}k`;
  return formatNumber(Math.round(value));
}

function auctionRank(auction: ChinaCfdAuction) {
  const date = auction.announcement_date
    ? Date.parse(auction.announcement_date)
    : 0;
  return (Number.isFinite(date) ? date : 0) * 10000 + (auction.delivery_year ?? 0);
}

function buildOverview(auctions: readonly ChinaCfdAuction[]) {
  const published = auctions.filter((auction) => auction.is_published);
  const completed = published.filter((auction) => auction.status === "已完成");
  const windStrikes = completed
    .map((auction) => auction.onshore_wind_strike)
    .filter((value): value is number => value != null);
  const solarStrikes = completed
    .map((auction) => auction.solar_strike)
    .filter((value): value is number => value != null);
  const awardedTotal = completed.reduce(
    (sum, auction) => sum + (auction.awarded_volume_gwh ?? 0),
    0,
  );
  const provincesWithResult = new Set(
    completed
      .filter(
        (auction) =>
          auction.onshore_wind_strike != null || auction.solar_strike != null,
      )
      .map((auction) => auction.province_label),
  ).size;

  const latestByProvince = new Map<string, ChinaCfdAuction>();
  for (const auction of completed) {
    if (
      auction.onshore_wind_strike == null &&
      auction.solar_strike == null
    ) {
      continue;
    }
    const current = latestByProvince.get(auction.province_label);
    if (!current || auctionRank(auction) > auctionRank(current)) {
      latestByProvince.set(auction.province_label, auction);
    }
  }

  const provinceStrikes: ProvinceStrike[] = [...latestByProvince.values()]
    .map((auction) => ({
      regionId: auction.region_id,
      label: auction.province_label,
      wind: auction.onshore_wind_strike,
      solar: auction.solar_strike,
      coal: auction.coal_benchmark,
      deliveryYear: auction.delivery_year,
    }))
    .sort((left, right) => {
      const leftPrice = left.wind ?? left.solar ?? 0;
      const rightPrice = right.wind ?? right.solar ?? 0;
      return rightPrice - leftPrice;
    });

  return {
    recordCount: published.length,
    completedCount: completed.length,
    provincesWithResult,
    awardedTotal: awardedTotal > 0 ? awardedTotal : null,
    medianWind: median(windStrikes),
    medianSolar: median(solarStrikes),
    windMin: windStrikes.length ? Math.min(...windStrikes) : null,
    windMax: windStrikes.length ? Math.max(...windStrikes) : null,
    solarMin: solarStrikes.length ? Math.min(...solarStrikes) : null,
    solarMax: solarStrikes.length ? Math.max(...solarStrikes) : null,
    provinceStrikes,
  };
}

function StrikeBars({
  rows,
  onProvinceSelect,
}: {
  rows: ProvinceStrike[];
  onProvinceSelect?: (regionId: string, provinceLabel: string) => void;
}) {
  const maxPrice = Math.max(
    1,
    ...rows.flatMap((row) =>
      [row.wind, row.solar, row.coal].filter(
        (value): value is number => value != null,
      ),
    ),
  );

  return (
    <ul className={styles.strikeList}>
      {rows.map((row) => {
        const windPct = row.wind == null ? 0 : (row.wind / maxPrice) * 100;
        const solarPct = row.solar == null ? 0 : (row.solar / maxPrice) * 100;
        const coalPct = row.coal == null ? null : (row.coal / maxPrice) * 100;
        const ariaParts = [
          row.wind != null ? `陆上风电 ${Math.round(row.wind)} 元每兆瓦时` : null,
          row.solar != null ? `光伏 ${Math.round(row.solar)} 元每兆瓦时` : null,
          row.coal != null ? `煤电基准 ${Math.round(row.coal)} 元每兆瓦时` : null,
        ].filter(Boolean);

        return (
          <li key={`${row.label}-${row.deliveryYear ?? "na"}`}>
            <button
              type="button"
              className={styles.strikeRow}
              aria-label={`${row.label}：${ariaParts.join("，") || "暂无出清价"}`}
              onClick={() => onProvinceSelect?.(row.regionId, row.label)}
            >
              <span className={styles.strikeLabel}>{row.label}</span>
              <span className={styles.strikeBars} aria-hidden="true">
                {row.wind != null ? (
                  <span className={styles.barLine}>
                    <i
                      className={styles.barWind}
                      style={{ width: `${Math.max(windPct, 1.2)}%` }}
                    />
                    <b
                      className={styles.barTip}
                      data-tone="wind"
                      style={{ left: `${Math.max(windPct, 1.2)}%` }}
                    >
                      风 {Math.round(row.wind)}
                    </b>
                  </span>
                ) : null}
                {row.solar != null ? (
                  <span className={styles.barLine}>
                    <i
                      className={styles.barSolar}
                      style={{ width: `${Math.max(solarPct, 1.2)}%` }}
                    />
                    <b
                      className={styles.barTip}
                      data-tone="solar"
                      style={{ left: `${Math.max(solarPct, 1.2)}%` }}
                    >
                      光 {Math.round(row.solar)}
                    </b>
                  </span>
                ) : null}
                {coalPct != null ? (
                  <em className={styles.coalMarker} style={{ left: `${coalPct}%` }} />
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ChinaCfdOverviewDashboard({
  auctions,
  onProvinceSelect,
}: {
  auctions: readonly ChinaCfdAuction[];
  onProvinceSelect?: (regionId: string, provinceLabel: string) => void;
}) {
  if (!auctions.length) return null;

  const overview = buildOverview(auctions);
  const strikeRows = overview.provinceStrikes.slice(0, 16);

  return (
    <section
      id="china-cfd-overview"
      className={styles.dashboard}
      aria-labelledby="china-cfd-overview-title"
    >
      <header className={styles.header}>
        <div>
          <span>Auction overview</span>
          <h3 id="china-cfd-overview-title">机制电价竞价速览</h3>
          <p>
            基于已发布的省级竞价记录，汇总完成进度与出清价区间。
            点击省份可跳转到下方省份政策板块；空值不计入统计。
          </p>
        </div>
        <a className={styles.jumpLink} href="#china-cfd-auctions">
          查看竞价总表 →
        </a>
      </header>

      <dl className={styles.kpiGrid}>
        <div>
          <dt>竞价记录</dt>
          <dd>{overview.recordCount}</dd>
        </div>
        <div>
          <dt>已完成</dt>
          <dd>
            {overview.completedCount}
            <small>/ {overview.recordCount}</small>
          </dd>
        </div>
        <div>
          <dt>有出清价省份</dt>
          <dd>{overview.provincesWithResult}</dd>
        </div>
        <div>
          <dt>中标电量合计</dt>
          <dd>
            {formatGwh(overview.awardedTotal)}
            <small>GWh</small>
          </dd>
        </div>
        <div>
          <dt>风电出清中位</dt>
          <dd>
            {formatNumber(overview.medianWind, 0)}
            <small>元/MWh</small>
          </dd>
        </div>
        <div>
          <dt>光伏出清中位</dt>
          <dd>
            {formatNumber(overview.medianSolar, 0)}
            <small>元/MWh</small>
          </dd>
        </div>
      </dl>

      <article className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <span>Strike price</span>
            <h4>最新一轮出清价</h4>
          </div>
          <p>
            风 {formatNumber(overview.windMin)}–
            {formatNumber(overview.windMax)} · 光{" "}
            {formatNumber(overview.solarMin)}–
            {formatNumber(overview.solarMax)} 元/MWh
          </p>
        </div>
        <div className={styles.legend}>
          <span data-tone="wind">陆上风电</span>
          <span data-tone="solar">光伏</span>
          <span data-tone="coal">煤电基准</span>
        </div>
        <div className={styles.chartScroll}>
          {strikeRows.length ? (
            <StrikeBars
              rows={strikeRows}
              onProvinceSelect={onProvinceSelect}
            />
          ) : (
            <p className={styles.empty}>暂无已公布出清价。</p>
          )}
        </div>
        {overview.provinceStrikes.length > strikeRows.length ? (
          <p className={styles.footnote}>
            按出清价从高到低展示前 {strikeRows.length} 个省份；点击可定位下方省份政策。
          </p>
        ) : (
          <p className={styles.footnote}>点击省份可定位下方省份政策板块。</p>
        )}
      </article>
    </section>
  );
}
