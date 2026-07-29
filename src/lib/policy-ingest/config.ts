/**
 * Weekly policy ingest knobs (framework v2).
 * Tune per-region quotas here when source quality drifts.
 */
export const POLICY_INGEST_LOOKBACK_DAYS = 14;
export const POLICY_INGEST_WEEKLY_CAP = 12;
export const POLICY_INGEST_MIN_IMPORTANCE = 0.55;
export const POLICY_INGEST_MAX_CANDIDATES_PER_FEED = 25;
export const POLICY_INGEST_MAX_DETAIL_CHARS = 12_000;

/** Soft per-region draft budgets within the global weekly cap. */
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
