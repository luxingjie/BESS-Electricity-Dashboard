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
import { regionQuota } from "@/lib/policy-ingest/config";
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
    const slugs = new Set(POLICY_SOURCE_FEED_SEEDS.map((feed) => feed.region_slug));
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

  it("keeps china quota inside the weekly envelope", () => {
    expect(regionQuota("china")).toBeGreaterThanOrEqual(1);
    expect(regionQuota("china")).toBeLessThanOrEqual(6);
    expect(regionQuota("unknown-country")).toBe(1);
  });
});
