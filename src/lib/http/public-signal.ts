import type { Signal } from "@/lib/types";

/** Stable public DTO. Internal Auth UUIDs never cross the Viewer API. */
export function toPublicSignal(signal: Signal) {
  return {
    id: signal.id,
    region_id: signal.region_id,
    signal_type: signal.signal_type,
    title: signal.title,
    summary: signal.summary,
    body: signal.body,
    category: signal.category,
    original_status: signal.original_status,
    normalized_status: signal.normalized_status,
    event_date: signal.event_date,
    effective_date: signal.effective_date,
    expires_at: signal.expires_at,
    impact_channel: signal.impact_channel,
    impact_direction: signal.impact_direction,
    impact_level: signal.impact_level,
    source_url: signal.source_url,
    source_name: signal.source_name,
    issuer: signal.issuer,
    document_id: signal.document_id ?? null,
    ai_importance: signal.ai_importance ?? null,
    policy_track: signal.policy_track ?? null,
    star_mark: Boolean(signal.star_mark),
    needs_human_review: signal.needs_human_review,
    reviewer_note: signal.reviewer_note,
    review_status: signal.review_status,
    published_at: signal.published_at,
    reviewed_at: signal.reviewed_at,
    crawled_at: signal.crawled_at,
    is_demo: signal.is_demo,
    created_at: signal.created_at,
    updated_at: signal.updated_at,
  };
}
