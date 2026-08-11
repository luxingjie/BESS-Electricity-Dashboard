import { describe, expect, it } from "vitest";

import {
  classifyCandidateTitle,
  isStaleDate,
} from "@/lib/policy-ingest/hard-filter";
import {
  contentHash,
  isNearDuplicateTitle,
  normalizePolicyUrl,
  titleSimilarity,
} from "@/lib/policy-ingest/dedupe";
import { parsePolicyListHtml } from "@/lib/policy-ingest/list-parser";
import {
  decideIngestDisposition,
  POLICY_INGEST_AUTO_PUBLISH_MIN,
  POLICY_INGEST_DAILY_CAP,
  regionQuota,
} from "@/lib/policy-ingest/config";
import { selectAiDraftsToClean } from "@/lib/policy-ingest/cleanup";
import { POLICY_SOURCE_FEED_SEEDS } from "@/lib/policy-ingest/whitelist";

describe("policy hard filter", () => {
  it("rejects commentary titles", () => {
    const decision = classifyCandidateTitle({
      title: "储能政策周报解读：三点观察与展望",
    });
    expect(decision.accept).toBe(false);
    if (!decision.accept) expect(decision.reason).toBe("commentary");
  });

  it("accepts formal policy titles in scope", () => {
    const decision = classifyCandidateTitle({
      title: "国家能源局关于促进新型储能并网和调度运用的通知",
    });
    expect(decision).toEqual({ accept: true });
  });

  it("marks stale dates outside lookback", () => {
    const now = new Date("2026-07-28T00:00:00Z");
    expect(isStaleDate("2026-07-20", 14, now)).toBe(false);
    expect(isStaleDate("2026-06-01", 14, now)).toBe(true);
  });
});

describe("policy dedupe helpers", () => {
  it("normalizes tracking params and trailing slash", () => {
    expect(
      normalizePolicyUrl(
        "https://Example.com/path/?utm_source=x&id=1#frag",
      ),
    ).toBe("https://example.com/path?id=1");
  });

  it("hashes url + document id stably", () => {
    const left = contentHash({
      url: "https://example.com/a",
      title: "通知",
      documentId: "发改能源〔2026〕1号",
    });
    const right = contentHash({
      url: "https://example.com/a/",
      title: "通知",
      documentId: "发改能源〔2026〕1号",
    });
    expect(left).toBe(right);
  });

  it("detects near-duplicate titles", () => {
    expect(
      titleSimilarity(
        "关于促进新型储能并网和调度运用的通知",
        "关于促进新型储能并网调度运用的通知",
      ),
    ).toBeGreaterThan(0.5);
    expect(
      isNearDuplicateTitle(
        "AEMC storage rule change determination",
        "AEMC storage rule change determination final",
      ),
    ).toBe(true);
  });
});

describe("policy list parser", () => {
  it("extracts same-origin anchors with usable titles", () => {
    const html = `
      <html><body>
        <ul>
          <li><a href="/rules/storage-2026">Battery storage market rule determination 2026</a><time datetime="2026-07-20">2026-07-20</time></li>
          <li><a href="https://other.example/x">External</a></li>
          <li><a href="/rules/storage-2026">Battery storage market rule determination 2026</a></li>
          <li><a href="/more">更多</a></li>
        </ul>
      </body></html>
    `;
    const candidates = parsePolicyListHtml(
      html,
      "https://regulator.example/rules",
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.url).toBe(
      "https://regulator.example/rules/storage-2026",
    );
    expect(candidates[0]?.publishedAt).toBe("2026-07-20");
  });
});

describe("policy ingest whitelist + quotas", () => {
  it("seeds official feeds across BESS-active regions", () => {
    const slugs = new Set(
      POLICY_SOURCE_FEED_SEEDS.map((feed) => feed.region_slug),
    );
    for (const slug of [
      "china",
      "india",
      "malaysia",
      "indonesia",
      "australia",
      "usa",
      "chile",
      "brazil",
    ]) {
      expect(slugs.has(slug)).toBe(true);
    }
    expect(
      POLICY_SOURCE_FEED_SEEDS.every((feed) =>
        /^https?:\/\//.test(feed.list_url),
      ),
    ).toBe(true);
  });

  it("keeps china quota inside the daily envelope", () => {
    expect(regionQuota("china")).toBeGreaterThanOrEqual(1);
    expect(regionQuota("china")).toBeLessThanOrEqual(6);
    expect(regionQuota("unknown-country")).toBe(1);
    expect(POLICY_INGEST_DAILY_CAP).toBeGreaterThanOrEqual(
      regionQuota("china"),
    );
  });
});

describe("AI ingest disposition", () => {
  it("auto-publishes only when star_mark and importance meet threshold", () => {
    expect(
      decideIngestDisposition({
        importance: POLICY_INGEST_AUTO_PUBLISH_MIN,
        is_formal_policy: true,
        is_commentary: false,
        policy_track: "storage_power_market",
        star_mark: true,
      }),
    ).toBe("publish");
  });

  it("keeps high-importance without star as draft", () => {
    expect(
      decideIngestDisposition({
        importance: 0.95,
        is_formal_policy: true,
        is_commentary: false,
        policy_track: "storage_power_market",
        star_mark: false,
      }),
    ).toBe("draft");
  });

  it("keeps star-marked policies below auto-publish threshold as draft", () => {
    expect(
      decideIngestDisposition({
        importance: 0.6,
        is_formal_policy: true,
        is_commentary: false,
        policy_track: "esg",
        star_mark: true,
      }),
    ).toBe("draft");
  });

  it("keeps mid-importance formal policies as draft", () => {
    expect(
      decideIngestDisposition({
        importance: 0.6,
        is_formal_policy: true,
        is_commentary: false,
        policy_track: "both",
      }),
    ).toBe("draft");
  });

  it("rejects commentary, non-policy, out-of-track, and low importance", () => {
    expect(
      decideIngestDisposition({
        importance: 0.9,
        is_formal_policy: true,
        is_commentary: true,
        policy_track: "esg",
        star_mark: true,
      }),
    ).toBe("reject");
    expect(
      decideIngestDisposition({
        importance: 0.9,
        is_formal_policy: true,
        is_commentary: false,
        policy_track: "none",
        star_mark: true,
      }),
    ).toBe("reject");
    expect(
      decideIngestDisposition({
        importance: 0.4,
        is_formal_policy: true,
        is_commentary: false,
        policy_track: "storage_power_market",
        star_mark: true,
      }),
    ).toBe("reject");
  });
});

describe("policy hard filter noise exclusions", () => {
  it("rejects tenders, financing, and historical reviews", () => {
    for (const title of [
      "某储能项目中标公告",
      "公司完成新一轮融资",
      "2024年储能政策历史回顾",
      "行业展会通知",
    ]) {
      const decision = classifyCandidateTitle({ title });
      expect(decision.accept).toBe(false);
    }
  });
});

describe("ai_draft cleanup selection", () => {
  const now = new Date("2026-08-03T00:00:00Z");

  it("marks stale drafts and duplicate urls/hashes for deletion", () => {
    const ids = selectAiDraftsToClean(
      [
        {
          id: "keep-fresh",
          title: "新型储能调度通知",
          source_url: "https://nea.gov.cn/a",
          content_hash: "hash-a",
          event_date: "2026-07-28",
          created_at: "2026-07-28T10:00:00Z",
        },
        {
          id: "dup-url",
          title: "新型储能调度通知副本",
          source_url: "https://nea.gov.cn/a/",
          content_hash: "hash-b",
          event_date: "2026-07-27",
          created_at: "2026-07-27T10:00:00Z",
        },
        {
          id: "stale",
          title: "旧政策",
          source_url: "https://nea.gov.cn/old",
          content_hash: "hash-old",
          event_date: "2026-06-01",
          created_at: "2026-06-01T10:00:00Z",
        },
        {
          id: "near-title",
          title: "新型储能调度通知",
          source_url: "https://nea.gov.cn/c",
          content_hash: "hash-c",
          event_date: "2026-07-26",
          created_at: "2026-07-26T10:00:00Z",
        },
      ],
      14,
      now,
    );

    expect(ids).toContain("stale");
    expect(ids).toContain("dup-url");
    expect(ids).toContain("near-title");
    expect(ids).not.toContain("keep-fresh");
  });

  it("does not delete the newest draft in a duplicate group", () => {
    const ids = selectAiDraftsToClean(
      [
        {
          id: "newer",
          title: "同一文号通知",
          source_url: "https://example.com/doc",
          content_hash: "same",
          event_date: "2026-07-30",
          created_at: "2026-07-30T12:00:00Z",
        },
        {
          id: "older",
          title: "同一文号通知旧稿",
          source_url: "https://example.com/other",
          content_hash: "same",
          event_date: "2026-07-29",
          created_at: "2026-07-29T12:00:00Z",
        },
      ],
      14,
      now,
    );
    expect(ids).toEqual(["older"]);
  });
});
