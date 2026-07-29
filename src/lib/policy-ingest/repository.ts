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
    const { data, error } = await this.client
      .from("policy_ingest_runs")
      .insert(input)
      .select("*")
      .single();
    throwIfError("create policy ingest run", error);
    return data as PolicyIngestRun;
  }

  async updateRun(
    id: string,
    input: UpdatePolicyIngestRunInput,
  ): Promise<PolicyIngestRun> {
    const { data, error } = await this.client
      .from("policy_ingest_runs")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();
    throwIfError("update policy ingest run", error);
    return data as PolicyIngestRun;
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
}
