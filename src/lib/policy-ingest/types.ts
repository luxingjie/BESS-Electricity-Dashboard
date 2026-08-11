export const POLICY_INGEST_SKIP_REASONS = [
  "duplicate",
  "not_policy",
  "commentary",
  "out_of_scope",
  "fetch_error",
  "no_source_url",
  "below_importance",
  "weekly_cap",
  "stale",
] as const;

export type PolicyIngestSkipReason =
  (typeof POLICY_INGEST_SKIP_REASONS)[number];

export const POLICY_INGEST_RUN_STATUSES = [
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type PolicyIngestRunStatus =
  (typeof POLICY_INGEST_RUN_STATUSES)[number];

export const POLICY_INGEST_TRIGGERS = ["cron", "manual"] as const;
export type PolicyIngestTrigger = (typeof POLICY_INGEST_TRIGGERS)[number];

export interface PolicySourceFeed {
  id: string;
  region_slug: string;
  name: string;
  list_url: string;
  source_name: string;
  language: string;
  enabled: boolean;
  priority: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PolicyIngestRun {
  id: string;
  trigger: PolicyIngestTrigger;
  status: PolicyIngestRunStatus;
  lookback_days: number;
  weekly_cap: number;
  started_at: string;
  finished_at: string | null;
  feeds_scanned: number;
  candidates_seen: number;
  drafts_created: number;
  auto_published?: number;
  drafts_retained?: number;
  drafts_cleaned?: number;
  skips_recorded: number;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PolicyIngestSkip {
  id: string;
  run_id: string;
  feed_id: string | null;
  source_url: string | null;
  title: string | null;
  reason: PolicyIngestSkipReason;
  detail: string | null;
  created_at: string;
}

export interface PolicyListCandidate {
  title: string;
  url: string;
  publishedAt: string | null;
}

export interface PolicyAiDraft {
  title_zh: string;
  summary_zh: string;
  body_zh: string;
  document_id: string | null;
  issuer: string | null;
  normalized_status:
    | "draft"
    | "consultation"
    | "filed"
    | "approved"
    | "effective"
    | "suspended"
    | "other"
    | null;
  event_date: string | null;
  effective_date: string | null;
  expires_at: string | null;
  category: string | null;
  /** Dual-track label: storage/power market, ESG, both, or none (reject). */
  policy_track: "storage_power_market" | "esg" | "both" | "none";
  /** High-impact star (*) for BESS commercial / mandatory / market-access effects. */
  star_mark: boolean;
  importance: number;
  is_formal_policy: boolean;
  is_commentary: boolean;
  evidence_quote: string | null;
}

export type CreatePolicyIngestRunInput = Omit<
  PolicyIngestRun,
  "id" | "created_at" | "updated_at"
>;

export type UpdatePolicyIngestRunInput = Partial<
  Omit<PolicyIngestRun, "id" | "created_at">
>;

export type CreatePolicyIngestSkipInput = Omit<PolicyIngestSkip, "id" | "created_at">;
