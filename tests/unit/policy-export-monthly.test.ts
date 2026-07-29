import { describe, expect, it } from "vitest";

import {
  buildPolicyExportRows,
  isHighImpactPolicy,
  policyRowsToMarkdown,
} from "@/lib/export/policy-signals";
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
    parent_id: null,
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
    id: "eu",
    slug: "europe",
    code: "CONT-EU",
    name_zh: "欧洲",
    name_en: "Europe",
    region_type: "continent",
    parent_id: null,
    is_demo: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: "de",
    slug: "germany",
    code: "DE",
    name_zh: "德国",
    name_en: "Germany",
    region_type: "country",
    parent_id: "eu",
    is_demo: true,
    created_at: now,
    updated_at: now,
  },
];

function signal(
  partial: Partial<Signal> & Pick<Signal, "id" | "region_id" | "title">,
): Signal {
  return {
    signal_type: "policy",
    summary: "影响摘要",
    category: "容量电价",
    original_status: null,
    normalized_status: "effective",
    event_date: "2026-07-01",
    effective_date: null,
    impact_channel: null,
    impact_direction: null,
    impact_level: null,
    source_url: "https://example.com/p",
    source_name: "发改委",
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

describe("policy monthly-report export shape", () => {
  it("marks high-impact and groups domestic/overseas sections", () => {
    const regionsById = new Map(regions.map((region) => [region.id, region]));
    const rows = buildPolicyExportRows(
      [
        signal({
          id: "1",
          region_id: "cn",
          title: "国家级通知",
          impact_level: "high",
        }),
        signal({ id: "2", region_id: "cn-sd", title: "山东规则" }),
        signal({ id: "3", region_id: "de", title: "德国电网费豁免" }),
      ],
      regionsById,
    );

    expect(isHighImpactPolicy(rows[0] as unknown as Signal)).toBe(false);
    expect(rows[0]?.importance_mark).toBe("***");
    expect(rows[0]?.section).toBe("domestic_national");
    expect(rows[1]?.section).toBe("domestic_regional");
    expect(rows[2]?.section).toBe("overseas");
    expect(rows[2]?.overseas_bloc).toBe("europe");

    const markdown = policyRowsToMarkdown(rows, {
      from: "2026-06-12",
      to: "2026-07-12",
      regionLabel: "全球（全部）",
    });
    expect(markdown).toContain("储能与 ESG 政策动态");
    expect(markdown).toContain("国内相关政策");
    expect(markdown).toContain("国家政策");
    expect(markdown).toContain("区域政策");
    expect(markdown).toContain("欧洲");
    expect(markdown).toContain("（***）国家级通知");
    expect(markdown).not.toContain("Key Takeaways");
  });
});
