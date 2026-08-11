import type {
  AdminSignalQuery,
  CreateSignalRecord,
  PublicSignalQuery,
  SignalRepository,
  UpdateSignalRecord,
} from "../../src/lib/repositories/contracts";
import type { Signal } from "../../src/lib/types";

function copy(signal: Signal): Signal {
  return { ...signal };
}
function containsSearch(signal: Signal, search: string | undefined): boolean {
  if (!search) {
    return true;
  }

  const needle = search.trim().toLocaleLowerCase();
  return [
    signal.title,
    signal.summary,
    signal.body,
    signal.category,
    signal.source_name,
    signal.issuer,
    signal.document_id,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase().includes(needle));
}

export class InMemorySignalRepository implements SignalRepository {
  protected readonly records = new Map<string, Signal>();
  private nextId = 1;

  constructor(seed: Signal[] = []) {
    for (const signal of seed) {
      this.records.set(signal.id, copy(signal));
    }
  }

  async listAdmin(query: AdminSignalQuery = {}): Promise<Signal[]> {
    return [...this.records.values()]
      .filter(
        (signal) =>
          (!query.region_id || signal.region_id === query.region_id) &&
          (!query.review_status ||
            signal.review_status === query.review_status) &&
          containsSearch(signal, query.search),
      )
      .slice(0, query.limit)
      .map(copy);
  }

  async listPublic(query: PublicSignalQuery = {}): Promise<Signal[]> {
    return [...this.records.values()]
      .filter((signal) => {
        const inRegion = query.region_ids
          ? signal.region_id !== null && query.region_ids.includes(signal.region_id)
          : !query.region_id || signal.region_id === query.region_id;

        return (
          signal.review_status === "published" &&
          inRegion &&
          containsSearch(signal, query.search)
        );
      })
      .slice(0, query.limit)
      .map(copy);
  }

  async getAdminById(id: string): Promise<Signal | null> {
    const signal = this.records.get(id);
    return signal ? copy(signal) : null;
  }

  async getPublicById(id: string): Promise<Signal | null> {
    const signal = this.records.get(id);
    return signal?.review_status === "published" ? copy(signal) : null;
  }

  async create(input: CreateSignalRecord): Promise<Signal> {
    const id = `signal-${this.nextId++}`;
    const signal: Signal = { id, ...input };
    this.records.set(id, copy(signal));
    return copy(signal);
  }

  async update(id: string, input: UpdateSignalRecord): Promise<Signal> {
    const current = this.records.get(id);
    if (!current) {
      throw new Error(`Signal ${id} does not exist`);
    }

    const updated: Signal = { ...current, ...input };
    this.records.set(id, copy(updated));
    return copy(updated);
  }
}

/** Deliberately unsafe adapter used to prove the service's second safety check. */
export class LeakyPublicSignalRepository extends InMemorySignalRepository {
  override async listPublic(query: PublicSignalQuery = {}): Promise<Signal[]> {
    return this.listAdmin({
      region_id: query.region_id,
      search: query.search,
      limit: query.limit,
    });
  }

  override async getPublicById(id: string): Promise<Signal | null> {
    return this.getAdminById(id);
  }
}

export function makeSignal(overrides: Partial<Signal> = {}): Signal {
  const timestamp = "2026-07-22T08:00:00.000Z";

  return {
    id: "signal-fixture",
    region_id: "region-shandong",
    signal_type: "policy",
    title: "DEMO 山东政策信号",
    summary: "仅用于验证发布工作流的 Demo 内容。",
    body: "仅用于验证发布工作流的 Demo 正文要点。",
    category: "Demo",
    policy_track: null,
    star_mark: false,
    original_status: "Filed",
    normalized_status: "filed",
    event_date: "2026-07-22",
    effective_date: null,
    expires_at: null,
    impact_channel: "revenue",
    impact_direction: "uncertain",
    impact_level: "medium",
    source_url: "https://example.com/demo-source",
    source_name: "Demo source",
    issuer: "Demo issuer",
    reviewer_note: "已人工核对 Demo 条目",
    needs_human_review: false,
    review_status: "published",
    published_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    crawled_at: timestamp,
    is_demo: true,
    reviewer_id: "admin-fixture",
    reviewed_at: timestamp,
    created_by: "admin-fixture",
    ...overrides,
  };
}
