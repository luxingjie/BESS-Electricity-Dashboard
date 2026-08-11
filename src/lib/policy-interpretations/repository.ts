import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  PolicyInterpretation,
  PolicyInterpretationPublic,
} from "./types";

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapRow(row: Record<string, unknown>): PolicyInterpretation {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    summary: row.summary == null ? null : String(row.summary),
    region_id: row.region_id == null ? null : String(row.region_id),
    region_bloc: String(row.region_bloc ?? ""),
    topic_tags: asTags(row.topic_tags),
    department: row.department == null ? null : String(row.department),
    original_filename: String(row.original_filename ?? ""),
    mime_type: String(row.mime_type ?? ""),
    file_ext: String(row.file_ext ?? ""),
    file_size_bytes: Number(row.file_size_bytes ?? 0),
    storage_path: String(row.storage_path ?? ""),
    is_demo: Boolean(row.is_demo),
    is_published: Boolean(row.is_published),
    published_at: row.published_at == null ? null : String(row.published_at),
    created_by: row.created_by == null ? null : String(row.created_by),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function toPublic(row: PolicyInterpretation): PolicyInterpretationPublic {
  const { storage_path: _storagePath, created_by: _createdBy, ...rest } = row;
  return rest;
}

export class PolicyInterpretationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<PolicyInterpretation[]> {
    const { data, error } = await this.client
      .from("policy_interpretations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async listPublic(filters?: {
    regionBloc?: string;
    topicTag?: string;
    dateFrom?: string;
    dateTo?: string;
    regionId?: string;
  }): Promise<PolicyInterpretationPublic[]> {
    let query = this.client
      .from("policy_interpretations")
      .select(
        "id, title, summary, region_id, region_bloc, topic_tags, department, original_filename, mime_type, file_ext, file_size_bytes, is_demo, is_published, published_at, created_at, updated_at",
      )
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(200);

    if (filters?.regionBloc) {
      query = query.eq("region_bloc", filters.regionBloc);
    }
    if (filters?.topicTag) {
      query = query.contains("topic_tags", [filters.topicTag]);
    }
    if (filters?.regionId) {
      query = query.eq("region_id", filters.regionId);
    }
    if (filters?.dateFrom) {
      query = query.gte("published_at", `${filters.dateFrom}T00:00:00.000Z`);
    }
    if (filters?.dateTo) {
      query = query.lte("published_at", `${filters.dateTo}T23:59:59.999Z`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) =>
      toPublic(mapRow(row as Record<string, unknown>)),
    );
  }

  async getById(id: string): Promise<PolicyInterpretation | null> {
    const { data, error } = await this.client
      .from("policy_interpretations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as Record<string, unknown>) : null;
  }

  async getPublicById(id: string): Promise<PolicyInterpretation | null> {
    const row = await this.getById(id);
    if (!row || !row.is_published) return null;
    return row;
  }

  async insert(
    input: Omit<PolicyInterpretation, "created_at" | "updated_at">,
  ): Promise<PolicyInterpretation> {
    const { data, error } = await this.client
      .from("policy_interpretations")
      .insert({
        id: input.id,
        title: input.title,
        summary: input.summary,
        region_id: input.region_id,
        region_bloc: input.region_bloc,
        topic_tags: input.topic_tags,
        department: input.department,
        original_filename: input.original_filename,
        mime_type: input.mime_type,
        file_ext: input.file_ext,
        file_size_bytes: input.file_size_bytes,
        storage_path: input.storage_path,
        is_demo: input.is_demo,
        is_published: input.is_published,
        published_at: input.published_at,
        created_by: input.created_by,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapRow(data as Record<string, unknown>);
  }

  async update(
    id: string,
    patch: Partial<{
      title: string;
      summary: string | null;
      region_id: string | null;
      region_bloc: string;
      topic_tags: string[];
      department: string | null;
      is_published: boolean;
      published_at: string | null;
    }>,
  ): Promise<PolicyInterpretation> {
    const { data, error } = await this.client
      .from("policy_interpretations")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return mapRow(data as Record<string, unknown>);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client
      .from("policy_interpretations")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }
}
