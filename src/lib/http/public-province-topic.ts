import type {
  ProvinceTopicRecordWithFields,
  PublicProvinceTopicRecordWithFields,
} from "@/lib/types";

/** Explicit Viewer mapper: Auth actor UUIDs must never cross this boundary. */
export function toPublicProvinceTopic(
  record: ProvinceTopicRecordWithFields,
): PublicProvinceTopicRecordWithFields {
  return {
    id: record.id,
    region_id: record.region_id,
    topic_id: record.topic_id,
    title: record.title,
    summary: record.summary,
    legal_status: record.legal_status,
    operational_status: record.operational_status,
    valid_from: record.valid_from,
    valid_to: record.valid_to,
    as_of_date: record.as_of_date,
    source_url: record.source_url,
    source_name: record.source_name,
    source_published_at: record.source_published_at,
    reviewer_note: record.reviewer_note,
    review_status: record.review_status,
    published_at: record.published_at,
    reviewed_at: record.reviewed_at,
    is_demo: record.is_demo,
    created_at: record.created_at,
    updated_at: record.updated_at,
    fields: record.fields,
  };
}
