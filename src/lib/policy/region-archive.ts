import { descendantRegionIds } from "@/lib/regions/descendant-ids";
import type { NormalizedStatus, Region, Signal } from "@/lib/types";

export type PublishedPolicySignal = Signal & {
  region_id: string;
  title: string;
  summary: string;
  source_url: string;
  normalized_status: NormalizedStatus;
  reviewer_note: string;
  signal_type: "policy";
};

export function isPublishedPolicySignal(
  signal: Signal,
): signal is PublishedPolicySignal {
  return (
    signal.signal_type === "policy" &&
    signal.review_status === "published" &&
    Boolean(signal.published_at) &&
    Boolean(signal.region_id?.trim()) &&
    Boolean(signal.title?.trim()) &&
    Boolean(signal.summary?.trim()) &&
    Boolean(signal.source_url?.trim()) &&
    Boolean(signal.normalized_status) &&
    Boolean(signal.reviewer_note?.trim())
  );
}

export function policySignalDate(signal: Signal): string {
  return (
    signal.event_date ||
    signal.published_at?.slice(0, 10) ||
    signal.created_at.slice(0, 10) ||
    ""
  );
}

/**
 * Region archive scope: the region itself plus all descendants
 * (e.g. China includes provinces; Asia includes all Asian countries).
 * Published policy signals with matching region_id are archived here.
 */
export function listRegionPolicyArchive(
  signals: readonly Signal[],
  regions: readonly Region[],
  archiveRegionId: string,
): PublishedPolicySignal[] {
  const scopeIds = descendantRegionIds(regions, archiveRegionId);
  return signals
    .filter(isPublishedPolicySignal)
    .filter((signal) => scopeIds.has(signal.region_id))
    .sort((left, right) =>
      policySignalDate(right).localeCompare(policySignalDate(left)),
    );
}
