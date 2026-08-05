import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AdminSignalQuery,
  CfdAuctionRepository,
  CreateCfdAuctionRecord,
  CreateMarketMetricRecord,
  CreateProvinceTopicField,
  CreateProvinceTopicRecord,
  CreateSignalRecord,
  MarketMetricRepository,
  AdminProvinceTopicQuery,
  ProvinceTopicRepository,
  PublicMarketMetricQuery,
  PublicProvinceTopicQuery,
  PublicSignalQuery,
  RegionRepository,
  SignalRepository,
  UpdateCfdAuctionRecord,
  UpdateMarketMetricRecord,
  UpdateProvinceTopicRecord,
  UpdateSignalRecord,
} from "./contracts";
import type {
  ChinaCfdAuction,
  MarketMetric,
  ProvinceTopicField,
  ProvinceTopicRecord,
  ProvinceTopicRecordWithFields,
  Region,
  Signal,
} from "../types";

const PUBLIC_SIGNAL_COLUMNS = [
  "id",
  "region_id",
  "signal_type",
  "title",
  "summary",
  "body",
  "category",
  "policy_track",
  "star_mark",
  "original_status",
  "normalized_status",
  "event_date",
  "effective_date",
  "expires_at",
  "impact_channel",
  "impact_direction",
  "impact_level",
  "source_url",
  "source_name",
  "issuer",
  "document_id",
  "ai_importance",
  "needs_human_review",
  "reviewer_note",
  "review_status",
  "published_at",
  "reviewed_at",
  "crawled_at",
  "is_demo",
  "created_at",
  "updated_at",
].join(",");

const PUBLIC_PROVINCE_TOPIC_COLUMNS = [
  "id",
  "region_id",
  "topic_id",
  "title",
  "summary",
  "legal_status",
  "operational_status",
  "valid_from",
  "valid_to",
  "as_of_date",
  "source_url",
  "source_name",
  "source_published_at",
  "reviewer_note",
  "review_status",
  "published_at",
  "reviewed_at",
  "is_demo",
  "created_at",
  "updated_at",
].join(",");

class PersistenceError extends Error {
  readonly status = 500;
  readonly code = "DATABASE_ERROR";

  constructor(operation: string, detail?: string) {
    super(`Database operation failed: ${operation}${detail ? ` (${detail})` : ""}`);
  }
}

function throwIfError(operation: string, error: { message: string } | null) {
  if (error) throw new PersistenceError(operation, error.message);
}

function matchesSearch(signal: Signal, search?: string) {
  const needle = search?.trim().toLocaleLowerCase("zh-CN");
  if (!needle) return true;

  return [
    signal.title,
    signal.summary,
    signal.body,
    signal.category,
    signal.original_status,
    signal.source_name,
    signal.issuer,
    signal.document_id,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase("zh-CN").includes(needle));
}

export class SupabaseSignalRepository implements SignalRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAdmin(query: AdminSignalQuery = {}): Promise<Signal[]> {
    let request = this.client.from("signals").select("*").order("updated_at", { ascending: false });
    if (query.region_id) request = request.eq("region_id", query.region_id);
    if (query.review_status) request = request.eq("review_status", query.review_status);
    if (query.limit) request = request.limit(query.limit);

    const { data, error } = await request;
    throwIfError("list admin signals", error);
    return ((data ?? []) as Signal[]).filter((signal) => matchesSearch(signal, query.search));
  }

  async listPublic(query: PublicSignalQuery = {}): Promise<Signal[]> {
    let request = this.client
      .from("signals")
      .select(PUBLIC_SIGNAL_COLUMNS)
      .eq("review_status", "published")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false });

    if (query.region_ids?.length) request = request.in("region_id", query.region_ids);
    else if (query.region_id) request = request.eq("region_id", query.region_id);
    if (query.limit && !query.search) request = request.limit(query.limit);

    const { data, error } = await request;
    throwIfError("list published signals", error);
    const filtered = ((data ?? []) as unknown as Signal[]).filter((signal) =>
      matchesSearch(signal, query.search),
    );
    return query.limit ? filtered.slice(0, query.limit) : filtered;
  }

  async getAdminById(id: string): Promise<Signal | null> {
    const { data, error } = await this.client.from("signals").select("*").eq("id", id).maybeSingle();
    throwIfError("read admin signal", error);
    return (data as unknown as Signal | null) ?? null;
  }

  async getPublicById(id: string): Promise<Signal | null> {
    const { data, error } = await this.client
      .from("signals")
      .select(PUBLIC_SIGNAL_COLUMNS)
      .eq("id", id)
      .eq("review_status", "published")
      .not("published_at", "is", null)
      .maybeSingle();
    throwIfError("read published signal", error);
    return (data as unknown as Signal | null) ?? null;
  }

  async create(input: CreateSignalRecord): Promise<Signal> {
    const { data, error } = await this.client.from("signals").insert(input).select("*").single();
    throwIfError("create signal", error);
    return data as Signal;
  }

  async update(id: string, input: UpdateSignalRecord): Promise<Signal> {
    const { data, error } = await this.client
      .from("signals")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();
    throwIfError("update signal", error);
    return data as Signal;
  }
}

export class SupabaseRegionRepository implements RegionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<Region[]> {
    const { data, error } = await this.client
      .from("regions")
      .select("*")
      .order("region_type")
      .order("name_zh");
    throwIfError("list regions", error);
    return (data ?? []) as Region[];
  }

  async getById(id: string): Promise<Region | null> {
    const { data, error } = await this.client.from("regions").select("*").eq("id", id).maybeSingle();
    throwIfError("read region", error);
    return (data as Region | null) ?? null;
  }

  async getBySlug(slug: string): Promise<Region | null> {
    const { data, error } = await this.client.from("regions").select("*").eq("slug", slug).maybeSingle();
    throwIfError("read region by slug", error);
    return (data as Region | null) ?? null;
  }
}

export class SupabaseMarketMetricRepository implements MarketMetricRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAdmin(regionId?: string): Promise<MarketMetric[]> {
    let request = this.client
      .from("market_metrics")
      .select("*")
      .order("updated_at", { ascending: false });
    if (regionId) request = request.eq("region_id", regionId);
    const { data, error } = await request;
    throwIfError("list admin market metrics", error);
    return (data ?? []) as MarketMetric[];
  }

  async listPublic(query: PublicMarketMetricQuery = {}): Promise<MarketMetric[]> {
    let request = this.client
      .from("market_metrics")
      .select("*")
      .eq("is_published", true)
      .order("label");
    if (query.region_ids?.length) request = request.in("region_id", query.region_ids);
    else if (query.region_id) request = request.eq("region_id", query.region_id);
    const { data, error } = await request;
    throwIfError("list published market metrics", error);
    return (data ?? []) as MarketMetric[];
  }

  async getAdminById(id: string): Promise<MarketMetric | null> {
    const { data, error } = await this.client
      .from("market_metrics")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfError("read admin market metric", error);
    return (data as MarketMetric | null) ?? null;
  }

  async create(input: CreateMarketMetricRecord): Promise<MarketMetric> {
    const { data, error } = await this.client
      .from("market_metrics")
      .insert(input)
      .select("*")
      .single();
    throwIfError("create market metric", error);
    return data as MarketMetric;
  }

  async update(id: string, input: UpdateMarketMetricRecord): Promise<MarketMetric> {
    const { data, error } = await this.client
      .from("market_metrics")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();
    throwIfError("update market metric", error);
    return data as MarketMetric;
  }
}

export class SupabaseCfdAuctionRepository implements CfdAuctionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAdmin(): Promise<ChinaCfdAuction[]> {
    const { data, error } = await this.client
      .from("china_cfd_auctions")
      .select("*")
      .order("grid_region")
      .order("province_label")
      .order("delivery_year", { ascending: true, nullsFirst: false });
    throwIfError("list admin cfd auctions", error);
    return (data ?? []) as ChinaCfdAuction[];
  }

  async listPublic(): Promise<ChinaCfdAuction[]> {
    const { data, error } = await this.client
      .from("china_cfd_auctions")
      .select("*")
      .eq("is_published", true)
      .order("grid_region")
      .order("province_label")
      .order("delivery_year", { ascending: true, nullsFirst: false });
    throwIfError("list published cfd auctions", error);
    return (data ?? []) as ChinaCfdAuction[];
  }

  async getAdminById(id: string): Promise<ChinaCfdAuction | null> {
    const { data, error } = await this.client
      .from("china_cfd_auctions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfError("read admin cfd auction", error);
    return (data as ChinaCfdAuction | null) ?? null;
  }

  async create(input: CreateCfdAuctionRecord): Promise<ChinaCfdAuction> {
    const { data, error } = await this.client
      .from("china_cfd_auctions")
      .insert(input)
      .select("*")
      .single();
    throwIfError("create cfd auction", error);
    return data as ChinaCfdAuction;
  }

  async update(
    id: string,
    input: UpdateCfdAuctionRecord,
  ): Promise<ChinaCfdAuction> {
    const { data, error } = await this.client
      .from("china_cfd_auctions")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();
    throwIfError("update cfd auction", error);
    return data as ChinaCfdAuction;
  }
}

export class SupabaseProvinceTopicRepository
  implements ProvinceTopicRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async listAdmin(
    query: AdminProvinceTopicQuery = {},
  ): Promise<ProvinceTopicRecord[]> {
    let request = this.client
      .from("china_province_topic_records")
      .select("*")
      .order("updated_at", { ascending: false });
    if (query.region_id) request = request.eq("region_id", query.region_id);
    if (query.topic_id) request = request.eq("topic_id", query.topic_id);
    if (query.review_status) {
      request = request.eq("review_status", query.review_status);
    }
    const { data, error } = await request;
    throwIfError("list admin province topics", error);
    return (data ?? []) as ProvinceTopicRecord[];
  }

  async listPublic(
    query: PublicProvinceTopicQuery = {},
  ): Promise<ProvinceTopicRecordWithFields[]> {
    let request = this.client
      .from("china_province_topic_records")
      .select(PUBLIC_PROVINCE_TOPIC_COLUMNS)
      .eq("review_status", "published")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false });
    if (query.region_ids?.length) {
      request = request.in("region_id", query.region_ids);
    } else if (query.region_id) {
      request = request.eq("region_id", query.region_id);
    }
    if (query.topic_id) request = request.eq("topic_id", query.topic_id);

    const { data, error } = await request;
    throwIfError("list published province topics", error);
    return this.withFields(
      (data ?? []) as unknown as ProvinceTopicRecord[],
    );
  }

  async getAdminById(
    id: string,
  ): Promise<ProvinceTopicRecordWithFields | null> {
    const { data, error } = await this.client
      .from("china_province_topic_records")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfError("read admin province topic", error);
    if (!data) return null;
    const [record] = await this.withFields([
      data as unknown as ProvinceTopicRecord,
    ]);
    return record ?? null;
  }

  async create(
    input: CreateProvinceTopicRecord,
  ): Promise<ProvinceTopicRecord> {
    const { data, error } = await this.client
      .from("china_province_topic_records")
      .insert(input)
      .select("*")
      .single();
    throwIfError("create province topic", error);
    return data as ProvinceTopicRecord;
  }

  async update(
    id: string,
    input: UpdateProvinceTopicRecord,
  ): Promise<ProvinceTopicRecord> {
    const { data, error } = await this.client
      .from("china_province_topic_records")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();
    throwIfError("update province topic", error);
    return data as ProvinceTopicRecord;
  }

  async replaceFields(
    recordId: string,
    input: CreateProvinceTopicField[],
  ): Promise<ProvinceTopicField[]> {
    const { error: deleteError } = await this.client
      .from("china_province_topic_fields")
      .delete()
      .eq("record_id", recordId);
    throwIfError("clear province topic fields", deleteError);

    if (!input.length) return [];
    const { data, error } = await this.client
      .from("china_province_topic_fields")
      .insert(input)
      .select("*");
    throwIfError("replace province topic fields", error);
    return (data ?? []) as ProvinceTopicField[];
  }

  private async withFields(
    records: ProvinceTopicRecord[],
  ): Promise<ProvinceTopicRecordWithFields[]> {
    if (!records.length) return [];
    const recordIds = records.map((record) => record.id);
    const { data, error } = await this.client
      .from("china_province_topic_fields")
      .select("*")
      .in("record_id", recordIds)
      .order("sort_order")
      .order("field_key");
    throwIfError("read province topic fields", error);

    const fieldsByRecord = new Map<string, ProvinceTopicField[]>();
    for (const field of (data ?? []) as ProvinceTopicField[]) {
      const fields = fieldsByRecord.get(field.record_id) ?? [];
      fields.push(field);
      fieldsByRecord.set(field.record_id, fields);
    }

    return records.map((record) => ({
      ...record,
      fields: fieldsByRecord.get(record.id) ?? [],
    }));
  }
}
