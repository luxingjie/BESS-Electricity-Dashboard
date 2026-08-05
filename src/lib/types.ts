export const REGION_TYPES = [
  "global",
  "continent",
  "country",
  "province",
] as const;
export type RegionType = (typeof REGION_TYPES)[number];

export const SIGNAL_TYPES = ["policy", "market"] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const REVIEW_STATUSES = [
  "ai_draft",
  "pending_review",
  "published",
  "rejected",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const NORMALIZED_STATUSES = [
  "draft",
  "consultation",
  "filed",
  "approved",
  "effective",
  "suspended",
  "other",
] as const;
export type NormalizedStatus = (typeof NORMALIZED_STATUSES)[number];

export interface Region {
  id: string;
  slug: string;
  code: string | null;
  name_zh: string;
  name_en: string | null;
  region_type: RegionType;
  parent_id: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * A signal can be incomplete while it is under review. Publication requirements
 * are intentionally enforced by the domain service instead of being hidden in
 * this storage-shaped type.
 */
export interface Signal {
  id: string;
  region_id: string | null;
  signal_type: SignalType;
  title: string | null;
  /** Short lead / one-paragraph abstract. */
  summary: string | null;
  /** Fuller policy main text / key points (distinct from summary). */
  body: string | null;
  category: string | null;
  original_status: string | null;
  normalized_status: NormalizedStatus | null;
  event_date: string | null;
  effective_date: string | null;
  /** Policy expiry / repeal date when known. */
  expires_at: string | null;
  impact_channel: string | null;
  impact_direction: string | null;
  impact_level: string | null;
  source_url: string | null;
  /** Feed / site label for the source page. */
  source_name: string | null;
  /** Issuing agency or authority (may differ from source_name). */
  issuer: string | null;
  reviewer_note: string | null;
  review_status: ReviewStatus;
  /** Explicit queue flag for drafts that still need a human. */
  needs_human_review: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  /** When the source document was fetched / ingested. */
  crawled_at: string | null;
  is_demo: boolean;
  reviewer_id?: string | null;
  reviewed_at: string | null;
  created_by?: string | null;
  /** Whitelist feed that produced this AI draft (policy ingest). */
  feed_id?: string | null;
  ingest_run_id?: string | null;
  content_hash?: string | null;
  ai_importance?: number | null;
  /** Official document / docket / file number when known. */
  document_id?: string | null;
  /** Dual-track label from AI ingest (persisted). */
  policy_track?: "storage_power_market" | "esg" | "both" | "none" | null;
  /** High-impact star; drives public （***） marker with auto-publish threshold. */
  star_mark?: boolean;
}

export interface MarketMetric {
  id: string;
  region_id: string;
  metric_key: string;
  label: string;
  value: number | null;
  unit: string | null;
  period_label: string | null;
  as_of_date: string | null;
  source_url: string | null;
  source_name: string | null;
  notes: string | null;
  is_demo: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export const PROVINCE_TOPIC_LEGAL_STATUSES = [
  "draft",
  "consultation",
  "published",
  "effective",
  "suspended",
  "superseded",
  "other",
] as const;
export type ProvinceTopicLegalStatus =
  (typeof PROVINCE_TOPIC_LEGAL_STATUSES)[number];

export const PROVINCE_TOPIC_OPERATIONAL_STATUSES = [
  "not_started",
  "simulation",
  "trial",
  "continuous",
  "suspended",
  "unknown",
] as const;
export type ProvinceTopicOperationalStatus =
  (typeof PROVINCE_TOPIC_OPERATIONAL_STATUSES)[number];

/**
 * Every public topic card has an explicit field coverage state. `available`
 * means that a reviewed value and its field-level source locator are present.
 * Missing information is never encoded as numeric zero.
 */
export const PROVINCE_TOPIC_FIELD_COVERAGE_STATUSES = [
  "available",
  "not_covered",
  "not_published",
  "not_applicable",
  "stale",
  "conflicting",
] as const;
export type ProvinceTopicFieldCoverageStatus =
  (typeof PROVINCE_TOPIC_FIELD_COVERAGE_STATUSES)[number];

export interface ProvinceTopicField {
  id: string;
  record_id: string;
  field_key: string;
  value_text: string | null;
  value_numeric: number | null;
  unit: string | null;
  coverage_status: ProvinceTopicFieldCoverageStatus;
  applicability: string | null;
  source_url: string | null;
  source_name: string | null;
  source_locator: string | null;
  evidence_excerpt: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProvinceTopicRecord {
  id: string;
  region_id: string;
  topic_id: import("./china-market/taxonomy").ChinaMarketTopicId;
  title: string | null;
  summary: string | null;
  legal_status: ProvinceTopicLegalStatus | null;
  operational_status: ProvinceTopicOperationalStatus | null;
  valid_from: string | null;
  valid_to: string | null;
  as_of_date: string | null;
  source_url: string | null;
  source_name: string | null;
  source_published_at: string | null;
  reviewer_note: string | null;
  review_status: ReviewStatus;
  published_at: string | null;
  reviewer_id?: string | null;
  reviewed_at: string | null;
  created_by?: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProvinceTopicRecordWithFields extends ProvinceTopicRecord {
  fields: ProvinceTopicField[];
}

/**
 * One province-level grid area x auction round in the China wind/solar CfD
 * (mechanism price, NDRC Doc 136) master table. NULL numeric values mean
 * "not published" and are never coerced to zero.
 */
export interface ChinaCfdAuction {
  id: string;
  region_id: string;
  province_label: string;
  province_label_en: string | null;
  grid_region: string | null;
  auction_round: string | null;
  announcement_date: string | null;
  delivery_year: number | null;
  commissioning_window: string | null;
  status: string | null;
  pot_design: string | null;
  onshore_wind_floor: number | null;
  onshore_wind_cap: number | null;
  onshore_wind_strike: number | null;
  offshore_wind_floor: number | null;
  offshore_wind_cap: number | null;
  offshore_wind_strike: number | null;
  solar_floor: number | null;
  solar_cap: number | null;
  solar_strike: number | null;
  coal_benchmark: number | null;
  target_volume_gwh: number | null;
  awarded_volume_gwh: number | null;
  subscription_rate: number | null;
  onshore_wind_target_gwh: number | null;
  onshore_wind_awarded_gwh: number | null;
  offshore_wind_target_gwh: number | null;
  offshore_wind_awarded_gwh: number | null;
  solar_target_gwh: number | null;
  solar_awarded_gwh: number | null;
  duration_years_onshore: number | null;
  duration_years_offshore: number | null;
  duration_years_solar: number | null;
  note: string | null;
  source_url: string | null;
  source_name: string | null;
  implementation_plan_url: string | null;
  implementation_plan_name: string | null;
  announcement_url: string | null;
  announcement_name: string | null;
  supplemental_url: string | null;
  supplemental_name: string | null;
  legacy_coverage_ratio: number | null;
  legacy_strike: number | null;
  legacy_duration_years: number | null;
  legacy_note: string | null;
  legacy_url: string | null;
  is_demo: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type ActorRole = "admin" | "reviewer" | "viewer";

export interface Actor {
  id: string;
  role: ActorRole;
  email?: string;
}
