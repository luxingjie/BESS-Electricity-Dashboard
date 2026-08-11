import type {
  BessProjectEvent,
  ChinaCfdAuction,
  MarketMetric,
  ProvinceTopicField,
  ProvinceTopicRecord,
  ProvinceTopicRecordWithFields,
  Region,
  ReviewStatus,
  Signal,
} from "../types";
import type { ChinaMarketTopicId } from "../china-market/taxonomy";

export interface AdminSignalQuery {
  region_id?: string;
  review_status?: ReviewStatus;
  search?: string;
  limit?: number;
}
export interface PublicSignalQuery {
  region_id?: string;
  region_ids?: string[];
  search?: string;
  limit?: number;
}

export type CreateSignalRecord = Omit<Signal, "id">;
export type UpdateSignalRecord = Partial<
  Omit<Signal, "id" | "created_at">
>;

/**
 * Public methods are a security boundary and implementations must query with
 * review_status = published. SignalService repeats that check defensively.
 */
export interface SignalRepository {
  listAdmin(query?: AdminSignalQuery): Promise<Signal[]>;
  listPublic(query?: PublicSignalQuery): Promise<Signal[]>;
  getAdminById(id: string): Promise<Signal | null>;
  getPublicById(id: string): Promise<Signal | null>;
  create(input: CreateSignalRecord): Promise<Signal>;
  update(id: string, input: UpdateSignalRecord): Promise<Signal>;
}

export interface RegionRepository {
  list(): Promise<Region[]>;
  getById(id: string): Promise<Region | null>;
  getBySlug(slug: string): Promise<Region | null>;
}

export interface PublicMarketMetricQuery {
  region_id?: string;
  region_ids?: string[];
}

export type CreateMarketMetricRecord = Omit<MarketMetric, "id">;
export type UpdateMarketMetricRecord = Partial<
  Omit<MarketMetric, "id" | "created_at">
>;

export interface MarketMetricRepository {
  listAdmin(regionId?: string): Promise<MarketMetric[]>;
  listPublic(query?: PublicMarketMetricQuery): Promise<MarketMetric[]>;
  getAdminById(id: string): Promise<MarketMetric | null>;
  create(input: CreateMarketMetricRecord): Promise<MarketMetric>;
  update(id: string, input: UpdateMarketMetricRecord): Promise<MarketMetric>;
}

export interface AdminProvinceTopicQuery {
  region_id?: string;
  topic_id?: ChinaMarketTopicId;
  review_status?: ReviewStatus;
}

export interface PublicProvinceTopicQuery {
  region_id?: string;
  region_ids?: string[];
  topic_id?: ChinaMarketTopicId;
}

export type CreateProvinceTopicRecord = Omit<ProvinceTopicRecord, "id">;
export type UpdateProvinceTopicRecord = Partial<
  Omit<ProvinceTopicRecord, "id" | "created_at">
>;
export type CreateProvinceTopicField = Omit<ProvinceTopicField, "id">;

export type CreateCfdAuctionRecord = Omit<ChinaCfdAuction, "id">;
export type UpdateCfdAuctionRecord = Partial<
  Omit<ChinaCfdAuction, "id" | "created_at">
>;

export interface CfdAuctionRepository {
  listAdmin(): Promise<ChinaCfdAuction[]>;
  listPublic(): Promise<ChinaCfdAuction[]>;
  getAdminById(id: string): Promise<ChinaCfdAuction | null>;
  create(input: CreateCfdAuctionRecord): Promise<ChinaCfdAuction>;
  update(id: string, input: UpdateCfdAuctionRecord): Promise<ChinaCfdAuction>;
}

export type CreateBessProjectEventRecord = Omit<
  BessProjectEvent,
  "id" | "candidates" | "created_at" | "updated_at"
>;

export interface PublicBessProjectEventQuery {
  event_type?: BessProjectEvent["event_type"];
  province_label?: string;
  scene?: string;
  plant_type?: string;
  search?: string;
  region_ids?: string[];
  include_unknown?: boolean;
  /** Inclusive YYYY-MM-DD */
  date_from?: string;
  /** Inclusive YYYY-MM-DD */
  date_to?: string;
  page?: number;
  page_size?: number;
}

export type PublicBessProjectEventPage = {
  items: BessProjectEvent[];
  total: number;
  page: number;
  page_size: number;
  counts: {
    all: number;
    tender: number;
    award: number;
    commissioning: number;
  };
  sources: string[];
};

export type PublicBessProjectAnalytics = import("../bess-projects/analytics").BessProjectAnalytics;

export interface BessProjectEventRepository {
  listPublicPage(
    query?: PublicBessProjectEventQuery,
  ): Promise<PublicBessProjectEventPage>;
  listPublicAnalytics(
    query?: PublicBessProjectEventQuery,
  ): Promise<PublicBessProjectAnalytics>;
  getPublicById(id: string): Promise<BessProjectEvent | null>;
}

export interface ProvinceTopicRepository {
  listAdmin(query?: AdminProvinceTopicQuery): Promise<ProvinceTopicRecord[]>;
  listPublic(
    query?: PublicProvinceTopicQuery,
  ): Promise<ProvinceTopicRecordWithFields[]>;
  getAdminById(id: string): Promise<ProvinceTopicRecordWithFields | null>;
  create(input: CreateProvinceTopicRecord): Promise<ProvinceTopicRecord>;
  update(
    id: string,
    input: UpdateProvinceTopicRecord,
  ): Promise<ProvinceTopicRecord>;
  replaceFields(
    recordId: string,
    input: CreateProvinceTopicField[],
  ): Promise<ProvinceTopicField[]>;
}
