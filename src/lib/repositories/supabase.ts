import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AdminSignalQuery,
  BessProjectEventRepository,
  CfdAuctionRepository,
  CreateCfdAuctionRecord,
  CreateMarketMetricRecord,
  CreateProvinceTopicField,
  CreateProvinceTopicRecord,
  CreateSignalRecord,
  MarketMetricRepository,
  AdminProvinceTopicQuery,
  ProvinceTopicRepository,
  PublicBessProjectEventPage,
  PublicBessProjectEventQuery,
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
  BessAwardCandidate,
  BessProjectEvent,
  ChinaCfdAuction,
  MarketMetric,
  ProvinceTopicField,
  ProvinceTopicRecord,
  ProvinceTopicRecordWithFields,
  Region,
  Signal,
} from "../types";

interface PublicFilterBuilder {
  eq(column: string, value: unknown): this;
  gte(column: string, value: unknown): this;
  lte(column: string, value: unknown): this;
  in(column: string, values: ReadonlyArray<unknown>): this;
  or(filters: string): this;
}

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

export class SupabaseBessProjectEventRepository
  implements BessProjectEventRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async listPublicPage(
    query: PublicBessProjectEventQuery = {},
  ): Promise<PublicBessProjectEventPage> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, Math.min(query.page_size ?? 15, 30));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const typedCount = async (eventType?: BessProjectEvent["event_type"]) => {
      let builder = this.client
        .from("bess_project_events")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true);
      builder = this.applyPublicFilters(builder, {
        ...query,
        event_type: undefined,
      });
      if (eventType) builder = builder.eq("event_type", eventType);
      const { count, error } = await builder;
      throwIfError("count bess project events", error);
      return count ?? 0;
    };

    const [all, tender, award, commissioning] = await Promise.all([
      typedCount(),
      typedCount("tender"),
      typedCount("award"),
      typedCount("commissioning"),
    ]);

    let listQuery = this.client
      .from("bess_project_events")
      .select("*")
      .eq("is_published", true)
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);
    listQuery = this.applyPublicFilters(listQuery, query);

    const { data, error } = await listQuery;
    throwIfError("list published bess project events page", error);
    const items = (data ?? []) as BessProjectEvent[];

    // List payload only needs the primary candidate for award rows.
    // Full candidate lists load on demand via getPublicById.
    const awardIds = items
      .filter((event) => event.event_type === "award")
      .map((event) => event.id);
    const candidatesByEvent = new Map<string, BessAwardCandidate[]>();
    if (awardIds.length) {
      const { data: candidates, error: candidateError } = await this.client
        .from("bess_award_candidates")
        .select("*")
        .in("event_id", awardIds)
        .or("is_primary.eq.true,rank_order.eq.1")
        .order("rank_order", { ascending: true, nullsFirst: false });
      throwIfError("list page bess award candidates", candidateError);
      for (const candidate of (candidates ?? []) as BessAwardCandidate[]) {
        const existing = candidatesByEvent.get(candidate.event_id);
        if (existing?.length) continue;
        candidatesByEvent.set(candidate.event_id, [candidate]);
      }
    }

    const sources = [
      ...new Set(
        items
          .map((event) => event.source_name)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    if (!sources.length) {
      sources.push("CESA储能应用分会");
    }

    const total = query.event_type
      ? query.event_type === "tender"
        ? tender
        : query.event_type === "award"
          ? award
          : commissioning
      : all;

    return {
      items: items.map((event) => ({
        ...event,
        candidates: candidatesByEvent.get(event.id) ?? [],
      })),
      total,
      page,
      page_size: pageSize,
      counts: { all, tender, award, commissioning },
      sources,
    };
  }

  private applyPublicFilters<T extends PublicFilterBuilder>(
    builder: T,
    query: PublicBessProjectEventQuery,
  ): T {
    let next = builder;
    if (query.event_type) next = next.eq("event_type", query.event_type);
    if (query.province_label) {
      next = next.eq("province_label", query.province_label);
    }
    if (query.scene) next = next.eq("scene", query.scene);
    if (query.plant_type) next = next.eq("plant_type", query.plant_type);
    if (query.date_from) next = next.gte("event_date", query.date_from);
    if (query.date_to) next = next.lte("event_date", query.date_to);
    if (query.region_ids?.length) {
      const ids = query.region_ids.join(",");
      next =
        query.include_unknown === false
          ? next.in("region_id", query.region_ids)
          : next.or(`region_id.in.(${ids}),region_id.is.null`);
    }
    const search = query.search?.trim();
    if (search) {
      const escaped = search.replace(/[%_,()]/g, " ").replace(/"/g, "");
      next = next.or(
        [
          `title.ilike.%${escaped}%`,
          `owner_name.ilike.%${escaped}%`,
          `owner_group.ilike.%${escaped}%`,
          `scope_label.ilike.%${escaped}%`,
          `province_raw.ilike.%${escaped}%`,
        ].join(","),
      );
    }
    return next;
  }

  async listPublicAnalytics(
    query: PublicBessProjectEventQuery = {},
  ): Promise<import("../bess-projects/analytics").BessProjectAnalytics> {
    const { data, error } = await this.client.rpc(
      "bess_project_events_analytics",
      {
        p_event_type: query.event_type ?? null,
        p_province: query.province_label ?? null,
        p_scene: query.scene ?? null,
        p_plant_type: query.plant_type ?? null,
        p_search: query.search?.trim() || null,
        p_region_ids: query.region_ids?.length ? query.region_ids : null,
        p_include_unknown: query.include_unknown !== false,
        p_date_from: query.date_from ?? null,
        p_date_to: query.date_to ?? null,
      },
    );
    throwIfError("bess project events analytics", error);

    const payload = (data ?? {}) as {
      sample_size?: number;
      counts?: {
        all?: number;
        tender?: number;
        award?: number;
        commissioning?: number;
      };
      by_month?: import("../bess-projects/analytics").AnalyticsBucket[];
      by_province?: import("../bess-projects/analytics").AnalyticsBucket[];
      by_scene?: import("../bess-projects/analytics").AnalyticsBucket[];
      by_duration?: import("../bess-projects/analytics").AnalyticsBucket[];
      by_scope?: import("../bess-projects/analytics").AnalyticsBucket[];
      date_min?: string | null;
      date_max?: string | null;
    };

    return {
      sample_size: payload.sample_size ?? 0,
      counts: {
        all: payload.counts?.all ?? 0,
        tender: payload.counts?.tender ?? 0,
        award: payload.counts?.award ?? 0,
        commissioning: payload.counts?.commissioning ?? 0,
      },
      by_month: payload.by_month ?? [],
      by_province: payload.by_province ?? [],
      by_scene: payload.by_scene ?? [],
      by_duration: payload.by_duration ?? [],
      by_scope: payload.by_scope ?? [],
      date_min: payload.date_min ?? null,
      date_max: payload.date_max ?? null,
    };
  }

  async getPublicById(id: string): Promise<BessProjectEvent | null> {
    const { data, error } = await this.client
      .from("bess_project_events")
      .select("*")
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();
    throwIfError("get published bess project event", error);
    if (!data) return null;

    const event = data as BessProjectEvent;
    if (event.event_type !== "award") {
      return { ...event, candidates: [] };
    }

    const { data: candidates, error: candidateError } = await this.client
      .from("bess_award_candidates")
      .select("*")
      .eq("event_id", id)
      .order("rank_order", { ascending: true, nullsFirst: false });
    throwIfError("list bess award candidates for detail", candidateError);

    return {
      ...event,
      candidates: (candidates ?? []) as BessAwardCandidate[],
    };
  }
}
