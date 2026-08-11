/**
 * Topic tags for internal policy interpretation briefs.
 * Kept separate from China provincial "八专题" market taxonomy.
 */
export const POLICY_INTERPRETATION_TOPIC_TAGS = [
  { key: "market-mechanism", label: "市场机制" },
  { key: "grid-connection", label: "并网接入" },
  { key: "capacity-compensation", label: "容量补偿" },
  { key: "price-mechanism", label: "电价机制" },
  { key: "safety-standard", label: "安全标准" },
  { key: "esg-carbon", label: "ESG / 碳" },
  { key: "tender-procurement", label: "招标采购" },
  { key: "other", label: "其他" },
] as const;

export type PolicyInterpretationTopicTag =
  (typeof POLICY_INTERPRETATION_TOPIC_TAGS)[number]["key"];

const TAG_LABELS = new Map(
  POLICY_INTERPRETATION_TOPIC_TAGS.map((tag) => [tag.key, tag.label]),
);

export function policyInterpretationTopicLabel(key: string): string {
  return TAG_LABELS.get(key as PolicyInterpretationTopicTag) ?? key;
}

export function isPolicyInterpretationTopicTag(
  value: string,
): value is PolicyInterpretationTopicTag {
  return TAG_LABELS.has(value as PolicyInterpretationTopicTag);
}
