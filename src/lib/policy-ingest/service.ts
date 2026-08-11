import "server-only";

import { extractHtmlDocument } from "@/lib/imports/html-extractor";
import { SafeUrlFetcher } from "@/lib/imports/url-fetcher";
import type {
  CreateSignalRecord,
  RegionRepository,
  SignalRepository,
} from "@/lib/repositories/contracts";
import type { Region, Signal } from "@/lib/types";

import { selectAiDraftsToClean } from "./cleanup";
import type { PolicyAiExtractor } from "./ai";
import {
  decideIngestDisposition,
  POLICY_INGEST_AUTO_PUBLISH_MIN,
  POLICY_INGEST_DAILY_CAP,
  POLICY_INGEST_LOOKBACK_DAYS,
  POLICY_INGEST_MAX_CANDIDATES_PER_FEED,
  POLICY_INGEST_MIN_IMPORTANCE,
  regionQuota,
} from "./config";
import {
  contentHash,
  isNearDuplicateTitle,
  normalizePolicyUrl,
} from "./dedupe";
import { classifyCandidateTitle, isStaleDate } from "./hard-filter";
import { parsePolicyListHtml } from "./list-parser";
import type { PolicyIngestRepository } from "./repository";
import type {
  PolicyIngestRun,
  PolicyIngestSkipReason,
  PolicyIngestTrigger,
  PolicySourceFeed,
} from "./types";

export type PolicyIngestRunResult = {
  run: PolicyIngestRun;
  draftIds: string[];
  publishedIds: string[];
  draftsCleaned: number;
};

export class PolicyIngestService {
  constructor(
    private readonly feeds: PolicyIngestRepository,
    private readonly signals: SignalRepository,
    private readonly regions: RegionRepository,
    private readonly aiFactory: () => PolicyAiExtractor,
    private readonly urlFetcher = new SafeUrlFetcher({
      userAgent: "GridLedgerPolicyIngest/1.0 (+https://grid-ledger.invalid)",
    }),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async run(options: {
    trigger: PolicyIngestTrigger;
    actorId: string | null;
    lookbackDays?: number;
    dailyCap?: number;
    /** @deprecated Use dailyCap */
    weeklyCap?: number;
  }): Promise<PolicyIngestRunResult> {
    const lookbackDays = options.lookbackDays ?? POLICY_INGEST_LOOKBACK_DAYS;
    const dailyCap =
      options.dailyCap ?? options.weeklyCap ?? POLICY_INGEST_DAILY_CAP;
    const now = this.clock();
    const nowIso = now.toISOString();

    const run = await this.feeds.createRun({
      trigger: options.trigger,
      status: "running",
      lookback_days: lookbackDays,
      weekly_cap: dailyCap,
      started_at: nowIso,
      finished_at: null,
      feeds_scanned: 0,
      candidates_seen: 0,
      drafts_created: 0,
      auto_published: 0,
      drafts_retained: 0,
      drafts_cleaned: 0,
      skips_recorded: 0,
      error_message: null,
      created_by: options.actorId,
    });

    const createdIds: string[] = [];
    const publishedIds: string[] = [];
    const draftIds: string[] = [];
    const acceptedTitles: string[] = [];
    const regionDraftCounts = new Map<string, number>();
    let feedsScanned = 0;
    let candidatesSeen = 0;
    let skipsRecorded = 0;
    let draftsCleaned = 0;

    const skip = async (input: {
      feed_id: string | null;
      source_url: string | null;
      title: string | null;
      reason: PolicyIngestSkipReason;
      detail: string | null;
    }) => {
      await this.feeds.createSkip({
        run_id: run.id,
        feed_id: input.feed_id,
        source_url: input.source_url,
        title: input.title,
        reason: input.reason,
        detail: input.detail,
      });
      skipsRecorded += 1;
    };

    try {
      draftsCleaned = await this.cleanupAiDrafts(lookbackDays, now);

      const allRegions = await this.regions.list();
      const regionBySlug = new Map(
        allRegions
          .filter((region) => region.region_type === "country")
          .map((region) => [region.slug, region]),
      );

      const enabledFeeds = (await this.feeds.listEnabledFeeds()).sort(
        (left, right) => right.priority - left.priority,
      );

      let ai: PolicyAiExtractor | null = null;
      const getAi = () => {
        if (!ai) ai = this.aiFactory();
        return ai;
      };

      for (const feed of enabledFeeds) {
        if (createdIds.length >= dailyCap) break;
        feedsScanned += 1;

        const region = regionBySlug.get(feed.region_slug);
        if (!region) {
          await skip({
            feed_id: feed.id,
            source_url: feed.list_url,
            title: feed.name,
            reason: "out_of_scope",
            detail: `未找到 region_slug=${feed.region_slug}`,
          });
          continue;
        }

        let listHtml: string;
        try {
          const fetched = await this.urlFetcher.fetch(feed.list_url);
          listHtml = Buffer.from(fetched.body).toString("utf8");
        } catch (error) {
          await skip({
            feed_id: feed.id,
            source_url: feed.list_url,
            title: feed.name,
            reason: "fetch_error",
            detail: error instanceof Error ? error.message : String(error),
          });
          continue;
        }

        const candidates = parsePolicyListHtml(listHtml, feed.list_url, {
          maxCandidates: POLICY_INGEST_MAX_CANDIDATES_PER_FEED,
        });

        for (const candidate of candidates) {
          if (createdIds.length >= dailyCap) {
            await skip({
              feed_id: feed.id,
              source_url: candidate.url,
              title: candidate.title,
              reason: "weekly_cap",
              detail: `已达日入审上限 ${dailyCap}`,
            });
            continue;
          }

          candidatesSeen += 1;
          const decision = classifyCandidateTitle(candidate);
          if (!decision.accept) {
            await skip({
              feed_id: feed.id,
              source_url: candidate.url,
              title: candidate.title,
              reason: decision.reason,
              detail: decision.detail,
            });
            continue;
          }

          if (isStaleDate(candidate.publishedAt, lookbackDays, now)) {
            await skip({
              feed_id: feed.id,
              source_url: candidate.url,
              title: candidate.title,
              reason: "stale",
              detail: `发布日期超出回溯窗 ${lookbackDays} 天`,
            });
            continue;
          }

          const normalizedUrl = normalizePolicyUrl(candidate.url);
          const existingUrl =
            await this.feeds.findSignalBySourceUrl(normalizedUrl);
          if (existingUrl) {
            await skip({
              feed_id: feed.id,
              source_url: normalizedUrl,
              title: candidate.title,
              reason: "duplicate",
              detail: `source_url 已存在 signal ${existingUrl.id}`,
            });
            continue;
          }

          if (
            acceptedTitles.some((title) =>
              isNearDuplicateTitle(title, candidate.title),
            )
          ) {
            await skip({
              feed_id: feed.id,
              source_url: normalizedUrl,
              title: candidate.title,
              reason: "duplicate",
              detail: "本轮标题高度相似",
            });
            continue;
          }

          const used = regionDraftCounts.get(feed.region_slug) ?? 0;
          if (used >= regionQuota(feed.region_slug)) {
            await skip({
              feed_id: feed.id,
              source_url: normalizedUrl,
              title: candidate.title,
              reason: "weekly_cap",
              detail: `区域 ${feed.region_slug} 配额已满`,
            });
            continue;
          }

          const created = await this.ingestDetail({
            feed,
            region,
            candidateUrl: normalizedUrl,
            listTitle: candidate.title,
            actorId: options.actorId ?? "cron",
            runId: run.id,
            getAi,
            skip,
          });

          if (created) {
            createdIds.push(created.id);
            acceptedTitles.push(created.title || candidate.title);
            regionDraftCounts.set(feed.region_slug, used + 1);
            if (created.review_status === "published") {
              publishedIds.push(created.id);
            } else {
              draftIds.push(created.id);
            }
          }
        }
      }

      const finished = await this.feeds.updateRun(run.id, {
        status: "completed",
        finished_at: this.clock().toISOString(),
        feeds_scanned: feedsScanned,
        candidates_seen: candidatesSeen,
        drafts_created: createdIds.length,
        auto_published: publishedIds.length,
        drafts_retained: draftIds.length,
        drafts_cleaned: draftsCleaned,
        skips_recorded: skipsRecorded,
        updated_at: this.clock().toISOString(),
      });

      return {
        run: finished,
        draftIds,
        publishedIds,
        draftsCleaned,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed = await this.feeds.updateRun(run.id, {
        status: "failed",
        finished_at: this.clock().toISOString(),
        feeds_scanned: feedsScanned,
        candidates_seen: candidatesSeen,
        drafts_created: createdIds.length,
        auto_published: publishedIds.length,
        drafts_retained: draftIds.length,
        drafts_cleaned: draftsCleaned,
        skips_recorded: skipsRecorded,
        error_message: message.slice(0, 4_000),
        updated_at: this.clock().toISOString(),
      });
      return {
        run: failed,
        draftIds,
        publishedIds,
        draftsCleaned,
      };
    }
  }

  private async cleanupAiDrafts(
    lookbackDays: number,
    now: Date,
  ): Promise<number> {
    const drafts = await this.feeds.listAiDraftSignals();
    const ids = selectAiDraftsToClean(drafts, lookbackDays, now);
    return this.feeds.deleteAiDraftsByIds(ids);
  }

  private async ingestDetail(input: {
    feed: PolicySourceFeed;
    region: Region;
    candidateUrl: string;
    listTitle: string;
    actorId: string;
    runId: string;
    getAi: () => PolicyAiExtractor;
    skip: (payload: {
      feed_id: string | null;
      source_url: string | null;
      title: string | null;
      reason: PolicyIngestSkipReason;
      detail: string | null;
    }) => Promise<void>;
  }): Promise<Signal | null> {
    let detailHtml: string;
    try {
      const fetched = await this.urlFetcher.fetch(input.candidateUrl);
      detailHtml = Buffer.from(fetched.body).toString("utf8");
    } catch (error) {
      await input.skip({
        feed_id: input.feed.id,
        source_url: input.candidateUrl,
        title: input.listTitle,
        reason: "fetch_error",
        detail: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    const extracted = extractHtmlDocument(detailHtml, input.candidateUrl);
    if (!extracted.text.trim()) {
      await input.skip({
        feed_id: input.feed.id,
        source_url: input.candidateUrl,
        title: input.listTitle,
        reason: "fetch_error",
        detail: "详情页未能提取正文",
      });
      return null;
    }

    let draft;
    try {
      draft = await input.getAi().extract({
        sourceUrl: input.candidateUrl,
        sourceName: input.feed.source_name,
        regionSlug: input.feed.region_slug,
        listTitle: input.listTitle,
        extractedText: extracted.text,
        actorId: input.actorId,
      });
    } catch (error) {
      await input.skip({
        feed_id: input.feed.id,
        source_url: input.candidateUrl,
        title: input.listTitle,
        reason: "fetch_error",
        detail: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    const disposition = decideIngestDisposition(draft);
    if (disposition === "reject") {
      await input.skip({
        feed_id: input.feed.id,
        source_url: input.candidateUrl,
        title: draft.title_zh || input.listTitle,
        reason: draft.is_commentary
          ? "commentary"
          : draft.policy_track === "none"
            ? "out_of_scope"
            : draft.importance < POLICY_INGEST_MIN_IMPORTANCE
              ? "below_importance"
              : "not_policy",
        detail: draft.is_commentary
          ? "AI 判定属解读稿"
          : draft.policy_track === "none"
            ? "未落入储能电力市场/ESG 双轨"
            : !draft.is_formal_policy
              ? "AI 判定非正式政策"
              : `importance=${draft.importance}`,
      });
      return null;
    }

    if (draft.document_id) {
      const existingDoc = await this.feeds.findSignalByDocumentId(
        draft.document_id,
      );
      if (existingDoc) {
        await input.skip({
          feed_id: input.feed.id,
          source_url: input.candidateUrl,
          title: draft.title_zh,
          reason: "duplicate",
          detail: `document_id 已存在 signal ${existingDoc.id}`,
        });
        return null;
      }
    }

    const hash = contentHash({
      url: input.candidateUrl,
      title: draft.title_zh,
      documentId: draft.document_id,
    });
    const existingHash = await this.feeds.findSignalByContentHash(hash);
    if (existingHash) {
      await input.skip({
        feed_id: input.feed.id,
        source_url: input.candidateUrl,
        title: draft.title_zh,
        reason: "duplicate",
        detail: `content_hash 已存在 signal ${existingHash.id}`,
      });
      return null;
    }

    const nowIso = this.clock().toISOString();
    const autoPublish = disposition === "publish";
    const starMarked = Boolean(draft.star_mark);
    // Keep titles clean; public UI uses the Key badge driven by star_mark.
    const titleZh = draft.title_zh.replace(/^[（(]\*\*\*[）)]\s*/, "");
    const importance = starMarked
      ? Math.max(draft.importance, POLICY_INGEST_AUTO_PUBLISH_MIN)
      : draft.importance;
    const record: CreateSignalRecord = {
      region_id: input.region.id,
      signal_type: "policy",
      title: titleZh,
      summary: draft.summary_zh,
      body: draft.body_zh,
      category: draft.category,
      policy_track: draft.policy_track,
      star_mark: starMarked,
      original_status: null,
      normalized_status: draft.normalized_status,
      event_date: draft.event_date,
      effective_date: draft.effective_date,
      expires_at: draft.expires_at,
      impact_channel: null,
      impact_direction: null,
      impact_level: starMarked ? "high" : null,
      source_url: input.candidateUrl,
      source_name: input.feed.source_name,
      issuer: draft.issuer ?? input.feed.source_name,
      reviewer_note: autoPublish ? "AI auto-publish" : null,
      needs_human_review: !autoPublish,
      review_status: autoPublish ? "published" : "ai_draft",
      published_at: autoPublish ? nowIso : null,
      created_at: nowIso,
      updated_at: nowIso,
      crawled_at: nowIso,
      is_demo: false,
      reviewer_id: null,
      reviewed_at: autoPublish ? nowIso : null,
      created_by: input.actorId === "cron" ? null : input.actorId,
      feed_id: input.feed.id,
      ingest_run_id: input.runId,
      content_hash: hash,
      ai_importance: importance,
      document_id: draft.document_id,
    };

    return this.signals.create(record);
  }
}
