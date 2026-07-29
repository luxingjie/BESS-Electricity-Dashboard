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
];

export type HardFilterDecision =
  | { accept: true }
  | { accept: false; reason: "commentary" | "not_policy" | "out_of_scope"; detail: string };

export function classifyCandidateTitle(
  candidate: Pick<PolicyListCandidate, "title">,
): HardFilterDecision {
  const title = candidate.title.trim();
  if (!title) {
    return { accept: false, reason: "not_policy", detail: "空标题" };
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
      detail: "标题缺少政策形态与储能/电力市场相关线索",
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
