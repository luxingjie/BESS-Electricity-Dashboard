/**
 * Localize BNEF CfD workbook English fragments for China-facing UI / import.
 */

const NOTE_ZH = {
  "Two utility-scale projects, 1617 small-scale projects":
    "2 个集中式项目，1617 个小规模项目",
  "Existing policies applied to power generation between June 1, 2025-December 31, 2025.":
    "2025年6月1日至2025年12月31日期间电量仍按既有政策执行。",
  "All awarded solar projects are small-scale solar projects.":
    "中标光伏项目均为小规模光伏。",
  "Source-grid-load-storage integration, green power direct connection, incremental distribution networks as well as general and large-scale commercial and industrial solar projects commissioned on or after June 1, 2025 (inclusive), all electricity fed into the grid—excluding self-consumed electricity—must participate in electricity market transactions and will not be able to participate in CfD auctions.":
    "源网荷储一体化、绿电直连、增量配电网，以及2025年6月1日（含）及以后投产的一般及大型工商业光伏项目，其上网电量（不含自发自用电量）须参与电力市场交易，不得参与机制电价竞价。",
  "For small-scale projects, if the self-consumption rate exceeds the provincial average for small-scale projects by more than 10 percentage points for two consecutive calendar years after commissioning, the duration may be extended by one year. The maximum allowable extension is two years; projects that have participated in previous bidding rounds but did not win must apply for a reduced CfD coverage in the next bidding round. The reduction scale is multiplied by 90% for each round.":
    "小规模项目投产后若连续两个自然年自发自用率高于全省小规模项目平均水平超过10个百分点，执行期限可延长1年，最长延长2年；此前已参与竞价但未中标的项目，下一轮须按缩减后的机制电量比例申报，每轮缩减系数乘以90%。",
  "Two utility-scale wind and one solar projects.":
    "2 个集中式风电项目和 1 个光伏项目。",
  "Seperate bidding for offshore wind and offshore solar is available. Source-grid-load-storage integration and green power direct connection, as well as large-scale commercial and industrial solar projects commissioned on or after June 1, 2025 (inclusive), all electricity fed into the grid—excluding self-consumed electricity—must participate in electricity market transactions and will not be able to participate in CfD auctions.":
    "海上风电与海上光伏可分开竞价。源网荷储一体化、绿电直连，以及2025年6月1日（含）及以后投产的大型工商业光伏项目，其上网电量（不含自发自用电量）须参与电力市场交易，不得参与机制电价竞价。",
  "One Huaneng deep-sea offshore wind project awarded CfD":
    "1 个华能深远海风电项目获得机制电价。",
  "Small-scale solar projects account for 99.5% of covered volume":
    "小规模光伏约占覆盖电量的 99.5%。",
  "Large-scale C&I solar projects are not included in the auction.":
    "大型工商业光伏未纳入本轮竞价。",
  "10 utility-scale solar projects, 2 onshore wind projects and the rest are all small-scale solar projects.":
    "10 个集中式光伏、2 个陆上风电，其余均为小规模光伏。",
  "Projects with significantly different costs, such as offshore wind in more distant and deeper areas, and special new energy projects that have already formed prices through competitive allocation, shall implement the feed-in tariff as specified by relevant policies. These projects will temporarily not participate in unified competitive bidding and will be implemented later based on the city’s actual conditions.":
    "成本差异较大的项目（如深远海风电）以及已通过竞争性配置形成价格的特殊新能源项目，按相关政策规定的上网电价执行；暂不参加统一竞价，后续结合本市实际另行实施。",
  "All awarded projects are solar projects.": "中标项目均为光伏。",
  "15 utility-scale solar projects are awarded CfD, no wind projects.":
    "15 个集中式光伏项目获得机制电价，无风电中标。",
  "The strike price for other projects is 384 yuan per megawatt-hour.":
    "其他项目出清价为 384 元/MWh。",
  "The strike price for 10 offshore solar projects awarded CfD is 388 yuan per megwatt-hour. No wind projects are awarded CfD.":
    "10 个海上光伏项目出清价为 388 元/MWh，无风电中标。",
  "CfD auctions don’t apply to utility-scale solar and onshore wind projects":
    "机制电价竞价不适用于集中式光伏和陆上风电项目。",
  "All awarded projects are small-scale solar projects, without the volume disclosed.":
    "中标项目均为小规模光伏，电量规模未披露。",
  "For offshore wind projects that have undergone competitive allocation but are not commissioned before June 1, 2025, and are commissioned by the end of 2026, the project-level CfD coverage ratio is 80% and duration is 20 years.":
    "已开展竞争性配置但未在2025年6月1日前投产、且在2026年底前投产的海上风电项目，项目级机制电量比例为80%，执行期限为20年。",
};

const POT_PHRASES = [
  [/deep-far offshore wind included/gi, "含深远海风电"],
  [/deep-far offshore wind not included/gi, "不含深远海风电"],
  [/offshore wind in deeper and more distant areas/gi, "深远海风电"],
  [
    /Projects included in the annual development and construction plan through competitive auctions \(including below 6 MW ground-mounted solar projects paired with energy storage/gi,
    "经竞争性配置纳入年度开发建设方案的项目（含6MW以下配套储能的地面光伏",
  ],
  [/Other projects/gi, "其他项目"],
  [/\(offshore solar included\)/gi, "（含海上光伏）"],
  [/Small-scale solar/gi, "小规模光伏"],
  [/Offshore solar/gi, "海上光伏"],
  [/Offshore wind/gi, "海上风电"],
  [/Onshore wind/gi, "陆上风电"],
  [/Other wind/gi, "其他风电"],
  [/Wind\+Solar\+Biomass/gi, "风电+光伏+生物质"],
  [/Wind\+Solar\*/gi, "风电+光伏*"],
  [/Wind\+Solar/gi, "风电+光伏"],
  [/Wind \| Solar\*/gi, "风电 | 光伏*"],
  [/Wind \| Solar/gi, "风电 | 光伏"],
  [/ \| Other/gi, " | 其他"],
  [/\bWind\b/gi, "风电"],
  [/\bSolar\b/gi, "光伏"],
  [/\bBiomass\b/gi, "生物质"],
  [/\bOther\b/gi, "其他"],
];

function localizeUsDate(raw) {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return raw.trim();
  const [, month, day, year] = match;
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function localizeCommissioningWindow(value) {
  if (!value) return null;
  const parts = value.split("-").map((part) => part.trim());
  if (
    parts.length === 2 &&
    parts.every((part) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(part))
  ) {
    return `${localizeUsDate(parts[0])}–${localizeUsDate(parts[1])}`;
  }
  return value;
}

export function localizePotDesign(value) {
  if (!value) return null;
  let text = value;
  for (const [pattern, replacement] of POT_PHRASES) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

export function localizeCfdNote(value) {
  if (!value) return null;
  return value
    .split("；")
    .map((segment) => {
      const trimmed = segment.trim();
      if (!trimmed) return "";
      if (NOTE_ZH[trimmed]) return NOTE_ZH[trimmed];
      const normalized = trimmed.replace(/[.’']/g, "'");
      const matched = Object.entries(NOTE_ZH).find(
        ([english]) => english.replace(/[.’']/g, "'") === normalized,
      );
      return matched ? matched[1] : trimmed;
    })
    .filter(Boolean)
    .join("；");
}

export function localizeSourceName(value) {
  if (!value) return null;
  if (/bloombergnef/i.test(value)) return "BNEF 参考";
  return value;
}
