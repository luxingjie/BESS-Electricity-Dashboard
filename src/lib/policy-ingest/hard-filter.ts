import type { PolicyListCandidate } from "./types";

const COMMENTARY_PATTERNS = [
  /解读/i,
  /点评/i,
  /盘点/i,
  /展望/i,
  /评论/i,
  /观察/i,
  /专栏/i,
  /opinion/i,
  /commentary/i,
  /explainer/i,
  /what\s+it\s+means/i,
  /market\s+outlook/i,
  /weekly\s+round.?up/i,
  /analyst\s+note/i,
  /blog\b/i,
  /行业分析/i,
  /深度分析/i,
];

/** Noise that should never enter the public policy feed. */
const EXCLUDE_NOISE_PATTERNS = [
  /融资/i,
  /上市/i,
  /IPO/i,
  /中标/i,
  /招标/i,
  /投标/i,
  /采购公告/i,
  /人物访谈/i,
  /专访/i,
  /展会/i,
  /论坛通知/i,
  /价格指数/i,
  /企业动态/i,
  /签约仪式/i,
  /历史回顾/i,
  /往年/i,
  /复盘/i,
  /年度盘点/i,
  /year[- ]?in[- ]?review/i,
  /retrospective/i,
  /tender\b/i,
  /rfp\b/i,
  /awarded\s+contract/i,
  /funding\s+round/i,
  /exhibition/i,
];

const POLICY_HINT_PATTERNS = [
  /办法/i,
  /通知/i,
  /规定/i,
  /条例/i,
  /规则/i,
  /征求意见/i,
  /公告/i,
  /令\b/i,
  /法令/i,
  /regulation/i,
  /order\b/i,
  /rule\b/i,
  /tariff/i,
  /determination/i,
  /directive/i,
  /notice/i,
  /consultation/i,
  /guideline/i,
  /decree/i,
  /resolu[cç][aã]o/i,
  /acuerdo/i,
  /normativa/i,
  /标准/i,
  /disclosure/i,
  /CBAM/i,
  /ETS/i,
  /CCER/i,
];

const SCOPE_HINT_PATTERNS = [
  /储能/i,
  /新型储能/i,
  /电力市场/i,
  /电价/i,
  /并网/i,
  /容量/i,
  /辅助服务/i,
  /现货/i,
  /中长期/i,
  /机制电价/i,
  /可再生/i,
  /风光/i,
  /配储/i,
  /构网/i,
  /绿证/i,
  /碳市场/i,
  /碳足迹/i,
  /碳关税/i,
  /气候披露/i,
  /电池回收/i,
  /battery/i,
  /storage/i,
  /bess/i,
  /energy\s+storage/i,
  /electricity\s+market/i,
  /wholesale/i,
  /capacity\s+market/i,
  /grid\s+connection/i,
  /ancillary/i,
  /renewable/i,
  /tariff/i,
  /power\s+market/i,
  /ESG/i,
  /CBAM/i,
  /carbon/i,
  /EPR/i,
];

export type HardFilterDecision =
  | { accept: true }
  | {
      accept: false;
      reason: "commentary" | "not_policy" | "out_of_scope";
      detail: string;
    };

export function classifyCandidateTitle(
  candidate: Pick<PolicyListCandidate, "title">,
): HardFilterDecision {
  const title = candidate.title.trim();
  if (!title) {
    return { accept: false, reason: "not_policy", detail: "空标题" };
  }

  if (EXCLUDE_NOISE_PATTERNS.some((pattern) => pattern.test(title))) {
    return {
      accept: false,
      reason: "out_of_scope",
      detail: "标题命中企业动态/招标/展会/历史回顾等排除类",
    };
  }

  if (COMMENTARY_PATTERNS.some((pattern) => pattern.test(title))) {
    return {
      accept: false,
      reason: "commentary",
      detail: "标题命中解读/评论类关键词",
    };
  }

  const looksLikePolicy = POLICY_HINT_PATTERNS.some((pattern) =>
    pattern.test(title),
  );
  const inScope = SCOPE_HINT_PATTERNS.some((pattern) => pattern.test(title));

  if (!looksLikePolicy && !inScope) {
    return {
      accept: false,
      reason: "out_of_scope",
      detail: "标题缺少政策形态与储能/电力市场/ESG 相关线索",
    };
  }

  if (!looksLikePolicy) {
    return {
      accept: false,
      reason: "not_policy",
      detail: "疑似非正式政策文件标题",
    };
  }

  return { accept: true };
}

export function isStaleDate(
  publishedAt: string | null,
  lookbackDays: number,
  now = new Date(),
): boolean {
  if (!publishedAt) return false;
  const parsed = Date.parse(publishedAt);
  if (Number.isNaN(parsed)) return false;
  const cutoff = now.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
  return parsed < cutoff;
}
