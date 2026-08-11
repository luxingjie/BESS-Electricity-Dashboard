import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreatePolicyIngestRunInput,
  CreatePolicyIngestSkipInput,
  PolicyIngestRun,
  PolicyIngestSkip,
  PolicySourceFeed,
  UpdatePolicyIngestRunInput,
} from "./types";
import { POLICY_SOURCE_FEED_SEEDS } from "./whitelist";

function throwIfError(action: string, error: { message: string } | null) {
  if (error) throw new Error(`${action}: ${error.message}`);
}

function seedAsFeeds(now: string): PolicySourceFeed[] {
  return POLICY_SOURCE_FEED_SEEDS.map((seed) => ({
    id: seed.id,
    region_slug: seed.region_slug,
    name: seed.name,
    list_url: seed.list_url,
    source_name: seed.source_name,
    language: seed.language,
    enabled: true,
    priority: seed.priority,
    notes: seed.notes ?? null,
    created_at: now,
    updated_at: now,
  }));
}

export class PolicyIngestRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listEnabledFeeds(): Promise<PolicySourceFeed[]> {
    const { data, error } = await this.client
      .from("policy_source_feeds")
      .select("*")
      .eq("enabled", true)
      .order("priority", { ascending: false });
    throwIfError("list policy source feeds", error);
    if (data?.length) return data as PolicySourceFeed[];
    return seedAsFeeds(new Date().toISOString());
  }

  async listRecentRuns(limit = 20): Promise<PolicyIngestRun[]> {
    const { data, error } = await this.client
      .from("policy_ingest_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);
    throwIfError("list policy ingest runs", error);
    return (data ?? []) as PolicyIngestRun[];
  }

  async listSkipsForRun(runId: string, limit = 200): Promise<PolicyIngestSkip[]> {
    const { data, error } = await this.client
      .from("policy_ingest_skips")
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(limit);
    throwIfError("list policy ingest skips", error);
    return (data ?? []) as PolicyIngestSkip[];
  }

  async createRun(input: CreatePolicyIngestRunInput): Promise<PolicyIngestRun> {
    const {
      auto_published: _autoPublished,
      drafts_retained: _draftsRetained,
      drafts_cleaned: _draftsCleaned,
      ...legacy
    } = input;
    const { data, error } = await this.client
      .from("policy_ingest_runs")
      .insert(legacy)
      .select("*")
      .single();
    throwIfError("create policy ingest run", error);
    return {
      ...(data as PolicyIngestRun),
      auto_published: _autoPublished ?? 0,
      drafts_retained: _draftsRetained ?? 0,
      drafts_cleaned: _draftsCleaned ?? 0,
    };
  }

  async updateRun(
    id: string,
    input: UpdatePolicyIngestRunInput,
  ): Promise<PolicyIngestRun> {
    const primary = await this.client
      .from("policy_ingest_runs")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();

    if (
      primary.error &&
      /auto_published|drafts_retained|drafts_cleaned/i.test(
        primary.error.message,
      )
    ) {
      const {
        auto_published: _a,
        drafts_retained: _b,
        drafts_cleaned: _c,
        ...legacy
      } = input;
      const fallback = await this.client
        .from("policy_ingest_runs")
        .update(legacy)
        .eq("id", id)
        .select("*")
        .single();
      throwIfError("update policy ingest run", fallback.error);
      return {
        ...(fallback.data as PolicyIngestRun),
        auto_published: _a ?? 0,
        drafts_retained: _b ?? 0,
        drafts_cleaned: _c ?? 0,
      };
    }

    throwIfError("update policy ingest run", primary.error);
    return primary.data as PolicyIngestRun;
  }

  async createSkip(input: CreatePolicyIngestSkipInput): Promise<PolicyIngestSkip> {
    const { data, error } = await this.client
      .from("policy_ingest_skips")
      .insert(input)
      .select("*")
      .single();
    throwIfError("create policy ingest skip", error);
    return data as PolicyIngestSkip;
  }

  async findSignalBySourceUrl(sourceUrl: string): Promise<{ id: string } | null> {
    const { data, error } = await this.client
      .from("signals")
      .select("id")
      .eq("source_url", sourceUrl)
      .limit(1)
      .maybeSingle();
    throwIfError("find signal by source_url", error);
    return data as { id: string } | null;
  }

  async findSignalByContentHash(
    contentHash: string,
  ): Promise<{ id: string } | null> {
    const { data, error } = await this.client
      .from("signals")
      .select("id")
      .eq("content_hash", contentHash)
      .limit(1)
      .maybeSingle();
    throwIfError("find signal by content_hash", error);
    return data as { id: string } | null;
  }

  async findSignalByDocumentId(
    documentId: string,
  ): Promise<{ id: string } | null> {
    const { data, error } = await this.client
      .from("signals")
      .select("id")
      .eq("document_id", documentId)
      .limit(1)
      .maybeSingle();
    throwIfError("find signal by document_id", error);
    return data as { id: string } | null;
  }

  async listAiDraftSignals(): Promise<
    Array<{
      id: string;
      title: string | null;
      source_url: string | null;
      content_hash: string | null;
      event_date: string | null;
      created_at: string;
    }>
  > {
    const { data, error } = await this.client
      .from("signals")
      .select("id,title,source_url,content_hash,event_date,created_at")
      .eq("review_status", "ai_draft")
      .eq("is_demo", false)
      .order("created_at", { ascending: false })
      .limit(2_000);
    throwIfError("list ai_draft signals", error);
    return (data ?? []) as Array<{
      id: string;
      title: string | null;
      source_url: string | null;
      content_hash: string | null;
      event_date: string | null;
      created_at: string;
    }>;
  }

  async deleteAiDraftsByIds(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const { data, error } = await this.client
      .from("signals")
      .delete()
      .in("id", ids)
      .eq("review_status", "ai_draft")
      .select("id");
    throwIfError("delete ai_draft signals", error);
    return data?.length ?? 0;
  }
}
