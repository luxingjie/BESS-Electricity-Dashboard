import type { NormalizedStatus, Signal } from "@/lib/types";

export type PublishedSignal = Signal & {
  region_id: string;
  title: string;
  summary: string;
  source_url: string;
  normalized_status: NormalizedStatus;
  reviewer_note: string;
};

/**
 * Shared publication guard that is safe to call from both Server and Client
 * Components. Keep this outside any `use client` module.
 */
export function isPublishedSignal(signal: Signal): signal is PublishedSignal {
  return (
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
