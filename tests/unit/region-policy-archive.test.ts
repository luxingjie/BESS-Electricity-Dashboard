import { describe, expect, it } from "vitest";

import { listRegionPolicyArchive } from "@/lib/policy/region-archive";
import type { Region, Signal } from "@/lib/types";

const now = "2026-07-28T08:00:00Z";

const regions: Region[] = [
  {
    id: "asia",
    slug: "asia",
    code: "CONT-AS",
    name_zh: "亚洲",
    name_en: "Asia",
    region_type: "continent",
    parent_id: "global",
    is_demo: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: "cn",
    slug: "china",
    code: "CN",
    name_zh: "中国",
    name_en: "China",
    region_type: "country",
    parent_id: "asia",
    is_demo: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: "cn-sd",
    slug: "shandong",
    code: "CN-SD",
    name_zh: "山东",
    name_en: "Shandong",
    region_type: "province",
    parent_id: "cn",
    is_demo: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: "us",
    slug: "usa",
    code: "US",
    name_zh: "美国",
    name_en: "United States",
    region_type: "country",
    parent_id: "na",
    is_demo: true,
    created_at: now,
    updated_at: now,
  },
];

function policy(partial: Partial<Signal> & Pick<Signal, "id" | "region_id" | "title">): Signal {
  return {
    signal_type: "policy",
    summary: "摘要",
    category: "储能",
    original_status: null,
    normalized_status: "effective",
    event_date: "2026-07-20",
    effective_date: null,
    impact_channel: null,
    impact_direction: null,
    impact_level: null,
    source_url: "https://example.com/policy",
    source_name: "测试源",
    reviewer_note: "已核",
    review_status: "published",
    published_at: now,
    created_at: now,
    updated_at: now,
    is_demo: true,
    reviewed_at: now,
    ...partial,
  };
}

describe("listRegionPolicyArchive", () => {
  const signals: Signal[] = [
    policy({ id: "p-sd", region_id: "cn-sd", title: "山东储能方案" }),
    policy({ id: "p-cn", region_id: "cn", title: "国家储能通知" }),
    policy({ id: "p-us", region_id: "us", title: "FERC update" }),
    policy({
      id: "p-market",
      region_id: "cn",
      title: "市场快讯",
      signal_type: "market",
    }),
    policy({
      id: "p-draft",
      region_id: "cn",
      title: "未发布",
      review_status: "pending_review",
      published_at: null,
    }),
  ];

  it("archives country policies including provinces", () => {
    const archived = listRegionPolicyArchive(signals, regions, "cn");
    expect(archived.map((item) => item.id).sort()).toEqual(["p-cn", "p-sd"]);
  });

  it("archives continent policies across descendant countries", () => {
    const archived = listRegionPolicyArchive(signals, regions, "asia");
    expect(archived.map((item) => item.id).sort()).toEqual(["p-cn", "p-sd"]);
  });

  it("keeps province archive local", () => {
    const archived = listRegionPolicyArchive(signals, regions, "cn-sd");
    expect(archived.map((item) => item.id)).toEqual(["p-sd"]);
  });
});
