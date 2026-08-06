import type {
  BessAwardCandidate,
  PublicBessAwardCandidate,
  PublicBessProjectEvent,
} from "@/lib/types";

export const PUBLIC_BESS_PROJECT_EVENT_SELECT = [
  "id",
  "event_type",
  "title",
  "event_date",
  "region_id",
  "province_label",
  "province_raw",
  "city_raw",
  "region_bloc",
  "power_mw",
  "energy_mwh",
  "duration_h",
  "duration_band",
  "scale_label",
  "c_rate",
  "scene",
  "plant_type",
  "technology",
  "owner_name",
  "owner_group",
  "counterparty_name",
  "scope_label",
  "status_label",
  "summary",
  "budget_wan",
  "unit_price_cap_yuan_per_wh",
  "result_date",
  "source_name",
  "is_demo",
].join(",");

export const PUBLIC_BESS_AWARD_CANDIDATE_SELECT = [
  "id",
  "event_id",
  "rank_label",
  "rank_order",
  "candidate_name",
  "candidate_group",
  "bid_amount_wan",
  "unit_price_yuan_per_wh",
  "is_primary",
].join(",");

export type PublicBessProjectEventRow = Omit<
  PublicBessProjectEvent,
  "candidates"
>;

export type PublicBessAwardCandidateRow = Pick<
  BessAwardCandidate,
  | "id"
  | "event_id"
  | "rank_label"
  | "rank_order"
  | "candidate_name"
  | "candidate_group"
  | "bid_amount_wan"
  | "unit_price_yuan_per_wh"
  | "is_primary"
>;

export function toPublicBessAwardCandidate(
  candidate: PublicBessAwardCandidateRow,
): PublicBessAwardCandidate {
  return {
    id: candidate.id,
    rank_label: candidate.rank_label,
    rank_order: candidate.rank_order,
    candidate_name: candidate.candidate_name,
    candidate_group: candidate.candidate_group,
    bid_amount_wan: candidate.bid_amount_wan,
    unit_price_yuan_per_wh: candidate.unit_price_yuan_per_wh,
    is_primary: candidate.is_primary,
  };
}

export function toPublicBessProjectEvent(
  event: PublicBessProjectEventRow,
  candidates: readonly PublicBessAwardCandidateRow[] = [],
): PublicBessProjectEvent {
  return {
    id: event.id,
    event_type: event.event_type,
    title: event.title,
    event_date: event.event_date,
    region_id: event.region_id,
    province_label: event.province_label,
    province_raw: event.province_raw,
    city_raw: event.city_raw,
    region_bloc: event.region_bloc,
    power_mw: event.power_mw,
    energy_mwh: event.energy_mwh,
    duration_h: event.duration_h,
    duration_band: event.duration_band,
    scale_label: event.scale_label,
    c_rate: event.c_rate,
    scene: event.scene,
    plant_type: event.plant_type,
    technology: event.technology,
    owner_name: event.owner_name,
    owner_group: event.owner_group,
    counterparty_name: event.counterparty_name,
    scope_label: event.scope_label,
    status_label: event.status_label,
    summary: event.summary,
    budget_wan: event.budget_wan,
    unit_price_cap_yuan_per_wh: event.unit_price_cap_yuan_per_wh,
    result_date: event.result_date,
    source_name: event.source_name,
    is_demo: event.is_demo,
    candidates: candidates.map(toPublicBessAwardCandidate),
  };
}
