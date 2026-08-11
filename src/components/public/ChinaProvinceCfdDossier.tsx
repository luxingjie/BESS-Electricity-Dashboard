import type { ChinaCfdAuction } from "@/lib/types";
import {
  localizeCfdNote,
  localizeCommissioningWindow,
  localizePotDesign,
  localizeSourceName,
} from "@/lib/china-market/cfd-localize";

import styles from "./ChinaProvinceCfdDossier.module.css";

type PolicyLink = {
  key: string;
  kind: string;
  label: string;
  url: string;
  name: string;
};

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null) return "—";
  return value.toLocaleString("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatGwh(value: number | null | undefined) {
  if (value == null) return "—";
  if (value >= 10000) return `${(value / 1000).toFixed(0)}k`;
  return formatNumber(Math.round(value));
}

function priceTriple(
  floor: number | null,
  cap: number | null,
  strike: number | null,
) {
  if (floor == null && cap == null && strike == null) return null;
  return `下限 ${formatNumber(floor, 1)} · 上限 ${formatNumber(cap, 1)} · 出清 ${formatNumber(strike, 1)}`;
}

function auctionTitle(auction: ChinaCfdAuction) {
  const parts = [
    auction.province_label,
    auction.delivery_year ? `${auction.delivery_year}年` : null,
    auction.auction_round,
    auction.status,
  ].filter(Boolean);
  return parts.join(" · ");
}

function collectPolicyLinks(auctions: readonly ChinaCfdAuction[]): PolicyLink[] {
  const seen = new Set<string>();
  const links: PolicyLink[] = [];

  function push(
    kind: string,
    url: string | null,
    name: string | null,
    fallbackName: string,
    label: string,
  ) {
    if (!url || seen.has(`${kind}:${url}`)) return;
    seen.add(`${kind}:${url}`);
    links.push({
      key: `${kind}:${url}`,
      kind,
      label,
      url,
      name: name || fallbackName,
    });
  }

  for (const auction of auctions) {
    push(
      "implementation",
      auction.implementation_plan_url,
      auction.implementation_plan_name,
      "省级实施方案",
      auction.province_label,
    );
    push(
      "announcement",
      auction.announcement_url,
      auction.announcement_name,
      "竞价公告",
      auctionTitle(auction),
    );
    push(
      "result",
      auction.source_url,
      localizeSourceName(auction.source_name),
      "结果公告",
      auctionTitle(auction),
    );
    push(
      "supplemental",
      auction.supplemental_url,
      auction.supplemental_name,
      "补充文件",
      auction.province_label,
    );
    push(
      "legacy",
      auction.legacy_url,
      null,
      "存量项目政策",
      auction.province_label,
    );
  }

  const order = [
    "implementation",
    "announcement",
    "result",
    "supplemental",
    "legacy",
  ];
  return links.sort(
    (left, right) => order.indexOf(left.kind) - order.indexOf(right.kind),
  );
}

function kindLabel(kind: string) {
  switch (kind) {
    case "implementation":
      return "实施方案";
    case "announcement":
      return "竞价公告";
    case "result":
      return "结果公告";
    case "supplemental":
      return "补充文件";
    case "legacy":
      return "存量政策";
    default:
      return kind;
  }
}

function sortAuctions(auctions: readonly ChinaCfdAuction[]) {
  return [...auctions].sort((left, right) => {
    const year = (right.delivery_year ?? 0) - (left.delivery_year ?? 0);
    if (year !== 0) return year;
    return (right.auction_round ?? "").localeCompare(
      left.auction_round ?? "",
      "zh-CN",
    );
  });
}

export function ChinaProvinceCfdDossier({
  auctions,
}: {
  auctions: readonly ChinaCfdAuction[];
}) {
  if (!auctions.length) {
    return (
      <section className={styles.dossier}>
        <header className={styles.head}>
          <span>Province auction dossier</span>
          <strong>本省机制电价拆解</strong>
        </header>
        <p className={styles.empty}>
          暂无本省竞价与政策链接数据；可在后台竞价记录中补充，或重新导入 BNEF 工作簿。
        </p>
      </section>
    );
  }

  const links = collectPolicyLinks(auctions);
  const rows = sortAuctions(auctions);
  const legacy = rows.find(
    (auction) =>
      auction.legacy_note ||
      auction.legacy_url ||
      auction.legacy_strike != null ||
      auction.legacy_coverage_ratio != null,
  );

  return (
    <section className={styles.dossier}>
      <header className={styles.head}>
        <span>Province auction dossier</span>
        <strong>本省机制电价拆解</strong>
        <p>
          从 BNEF 竞价库拆到本省：政策链接、存量机制安排，以及各轮上下限 / 出清价 /
          电量。
        </p>
      </header>

      <div className={styles.linksBlock}>
        <h4>政策与公告链接</h4>
        {links.length ? (
          <ul className={styles.linkList}>
            {links.map((link) => (
              <li key={link.key}>
                <em>{kindLabel(link.kind)}</em>
                <span>{link.label}</span>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.name} ↗
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyInline}>暂无已录入链接。</p>
        )}
      </div>

      {legacy ? (
        <div className={styles.legacyBlock}>
          <h4>存量项目机制安排</h4>
          <dl>
            <div>
              <dt>覆盖比例</dt>
              <dd>
                {legacy.legacy_coverage_ratio != null
                  ? `${formatNumber(legacy.legacy_coverage_ratio, 1)}%`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>机制电价</dt>
              <dd>
                {legacy.legacy_strike != null
                  ? `${formatNumber(legacy.legacy_strike, 1)} 元/MWh`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>执行年限</dt>
              <dd>
                {legacy.legacy_duration_years != null
                  ? `${formatNumber(legacy.legacy_duration_years, 1)} 年`
                  : "见下方说明"}
              </dd>
            </div>
          </dl>
          {legacy.legacy_note ? <p>{legacy.legacy_note}</p> : null}
          {legacy.legacy_url ? (
            <a href={legacy.legacy_url} target="_blank" rel="noreferrer">
              查看存量政策原文 ↗
            </a>
          ) : null}
        </div>
      ) : null}

      <div className={styles.roundList}>
        <h4>分轮竞价拆解</h4>
        {rows.map((auction) => {
          const wind = priceTriple(
            auction.onshore_wind_floor,
            auction.onshore_wind_cap,
            auction.onshore_wind_strike,
          );
          const offshore = priceTriple(
            auction.offshore_wind_floor,
            auction.offshore_wind_cap,
            auction.offshore_wind_strike,
          );
          const solar = priceTriple(
            auction.solar_floor,
            auction.solar_cap,
            auction.solar_strike,
          );
          return (
            <article
              className={styles.roundCard}
              key={`${auction.province_label}-${auction.auction_round}-${auction.delivery_year}-${auction.id}`}
            >
              <header>
                <strong>{auctionTitle(auction)}</strong>
                <span>
                  {[
                    localizePotDesign(auction.pot_design),
                    auction.grid_region,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </header>
              <dl className={styles.metrics}>
                <div>
                  <dt>并网窗口</dt>
                  <dd>
                    {localizeCommissioningWindow(auction.commissioning_window) ||
                      "—"}
                  </dd>
                </div>
                <div>
                  <dt>目标 / 中标</dt>
                  <dd>
                    {formatGwh(auction.target_volume_gwh)} /{" "}
                    {formatGwh(auction.awarded_volume_gwh)} GWh
                  </dd>
                </div>
                <div>
                  <dt>煤电基准</dt>
                  <dd>
                    {auction.coal_benchmark != null
                      ? `${formatNumber(auction.coal_benchmark, 1)} 元/MWh`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>执行期限</dt>
                  <dd>
                    {[
                      auction.duration_years_onshore != null
                        ? `陆风 ${formatNumber(auction.duration_years_onshore, 1)}年`
                        : null,
                      auction.duration_years_offshore != null
                        ? `海风 ${formatNumber(auction.duration_years_offshore, 1)}年`
                        : null,
                      auction.duration_years_solar != null
                        ? `光伏 ${formatNumber(auction.duration_years_solar, 1)}年`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </dd>
                </div>
              </dl>
              <ul className={styles.priceList}>
                {wind ? <li>陆上风电：{wind}</li> : null}
                {offshore ? <li>海上风电：{offshore}</li> : null}
                {solar ? <li>光伏：{solar}</li> : null}
                {!wind && !offshore && !solar ? (
                  <li>价格条款尚未公布</li>
                ) : null}
              </ul>
              {localizeCfdNote(auction.note) ? (
                <p className={styles.note}>{localizeCfdNote(auction.note)}</p>
              ) : null}
              <div className={styles.roundLinks}>
                {auction.announcement_url ? (
                  <a
                    href={auction.announcement_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    竞价公告 ↗
                  </a>
                ) : null}
                {auction.source_url ? (
                  <a href={auction.source_url} target="_blank" rel="noreferrer">
                    结果公告 ↗
                  </a>
                ) : null}
                {auction.supplemental_url ? (
                  <a
                    href={auction.supplemental_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    补充文件 ↗
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Fill empty topic field cards from auction dossier facts. */
export function deriveMechanismFieldValue(
  fieldKey: string,
  auctions: readonly ChinaCfdAuction[],
): { text: string; unit?: string; sourceUrl?: string | null } | null {
  if (!auctions.length) return null;
  const sorted = sortAuctions(auctions);
  const withStrike = sorted.find(
    (auction) =>
      auction.onshore_wind_strike != null || auction.solar_strike != null,
  );
  const legacy = sorted.find(
    (auction) =>
      auction.legacy_strike != null ||
      auction.legacy_note ||
      auction.legacy_coverage_ratio != null,
  );
  const withPlan = sorted.find((auction) => auction.implementation_plan_url);
  const withNote = sorted.find((auction) => auction.note);

  switch (fieldKey) {
    case "provincial_implementation_rule": {
      if (!withPlan?.implementation_plan_url) return null;
      return {
        text: withPlan.implementation_plan_name || "省级实施方案已发布",
        sourceUrl: withPlan.implementation_plan_url,
      };
    }
    case "existing_project_mechanism_price": {
      if (!legacy) return null;
      if (legacy.legacy_strike != null) {
        const coverage =
          legacy.legacy_coverage_ratio != null
            ? `（覆盖 ${formatNumber(legacy.legacy_coverage_ratio, 1)}%）`
            : "";
        return {
          text: `${formatNumber(legacy.legacy_strike, 1)}${coverage}`,
          unit: "元/MWh",
          sourceUrl: legacy.legacy_url,
        };
      }
      if (legacy.legacy_note) {
        return { text: legacy.legacy_note, sourceUrl: legacy.legacy_url };
      }
      return null;
    }
    case "incremental_project_mechanism_price": {
      if (!withStrike) return null;
      const parts = [
        withStrike.onshore_wind_strike != null
          ? `陆风 ${formatNumber(withStrike.onshore_wind_strike, 1)}`
          : null,
        withStrike.solar_strike != null
          ? `光伏 ${formatNumber(withStrike.solar_strike, 1)}`
          : null,
        withStrike.offshore_wind_strike != null
          ? `海风 ${formatNumber(withStrike.offshore_wind_strike, 1)}`
          : null,
      ].filter(Boolean);
      if (!parts.length) return null;
      return {
        text: parts.join(" · "),
        unit: "元/MWh",
        sourceUrl: withStrike.source_url ?? withStrike.announcement_url,
      };
    }
    case "mechanism_volume_scale": {
      const awarded = sorted.reduce(
        (sum, auction) => sum + (auction.awarded_volume_gwh ?? 0),
        0,
      );
      const target = sorted.reduce(
        (sum, auction) => sum + (auction.target_volume_gwh ?? 0),
        0,
      );
      if (awarded <= 0 && target <= 0) return null;
      return {
        text:
          awarded > 0
            ? `中标合计 ${formatGwh(awarded)}`
            : `目标合计 ${formatGwh(target)}`,
        unit: "GWh",
      };
    }
    case "execution_period": {
      const sample =
        sorted.find(
          (auction) =>
            auction.duration_years_onshore != null ||
            auction.duration_years_solar != null ||
            auction.commissioning_window,
        ) ?? null;
      if (!sample) return null;
      const durations = [
        sample.duration_years_onshore != null
          ? `陆风 ${formatNumber(sample.duration_years_onshore, 1)}年`
          : null,
        sample.duration_years_solar != null
          ? `光伏 ${formatNumber(sample.duration_years_solar, 1)}年`
          : null,
      ].filter(Boolean);
      if (durations.length) return { text: durations.join(" · ") };
      if (sample.commissioning_window) {
        return {
          text: `并网窗口 ${localizeCommissioningWindow(sample.commissioning_window)}`,
        };
      }
      return null;
    }
    case "settlement_rule": {
      if (withNote?.note) {
        return {
          text: localizeCfdNote(withNote.note) ?? withNote.note,
          sourceUrl: withNote.announcement_url ?? withNote.source_url,
        };
      }
      return null;
    }
    default:
      return null;
  }
}
