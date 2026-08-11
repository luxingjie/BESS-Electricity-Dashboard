/**
 * Daily policy ingest knobs (framework v2).
 * Tune per-region quotas here when source quality drifts.
 */
export const POLICY_INGEST_LOOKBACK_DAYS = 14;
/** Global daily ingest ceiling (stored in runs.weekly_cap for DB compatibility). */
export const POLICY_INGEST_DAILY_CAP = 10;
/** @deprecated Use POLICY_INGEST_DAILY_CAP */
export const POLICY_INGEST_WEEKLY_CAP = POLICY_INGEST_DAILY_CAP;
/** Minimum importance to create a signal (draft or published). */
export const POLICY_INGEST_MIN_IMPORTANCE = 0.55;
/** Minimum importance for AI auto-publish without human review. */
export const POLICY_INGEST_AUTO_PUBLISH_MIN = 0.7;
export const POLICY_INGEST_MAX_CANDIDATES_PER_FEED = 25;
export const POLICY_INGEST_MAX_DETAIL_CHARS = 12_000;

/** Soft per-region budgets within the global daily cap. */
export const POLICY_INGEST_REGION_QUOTAS: Readonly<Record<string, number>> = {
  china: 4,
  india: 2,
  malaysia: 1,
  indonesia: 1,
  australia: 2,
  "south-korea": 1,
  japan: 1,
  "united-kingdom": 1,
  usa: 2,
  canada: 1,
  mexico: 1,
  chile: 1,
  brazil: 1,
  germany: 1,
  france: 1,
  spain: 1,
  italy: 1,
  netherlands: 1,
};

export function regionQuota(regionSlug: string): number {
  return POLICY_INGEST_REGION_QUOTAS[regionSlug] ?? 1;
}

export type PolicyIngestDisposition = "publish" | "draft" | "reject";

/**
 * Decide whether an AI-extracted formal policy should auto-publish, stay draft,
 * or be rejected. Auto-publish requires star_mark AND importance ≥ threshold
 * (aligned with frontend （***） via POLICY_INGEST_AUTO_PUBLISH_MIN).
 */
export function decideIngestDisposition(draft: {
  importance: number;
  is_formal_policy: boolean;
  is_commentary: boolean;
  policy_track?: "storage_power_market" | "esg" | "both" | "none";
  star_mark?: boolean;
}): PolicyIngestDisposition {
  if (draft.is_commentary || !draft.is_formal_policy) return "reject";
  if (draft.policy_track === "none") return "reject";
  if (draft.importance < POLICY_INGEST_MIN_IMPORTANCE) return "reject";
  if (
    draft.star_mark &&
    draft.importance >= POLICY_INGEST_AUTO_PUBLISH_MIN
  ) {
    return "publish";
  }
  return "draft";
}
