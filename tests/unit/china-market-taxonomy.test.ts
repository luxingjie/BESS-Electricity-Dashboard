import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CHINA_MARKET_TOPICS,
  CHINA_MARKET_TOPIC_IDS,
  type ChinaMarketTopicId,
} from "@/lib/china-market/taxonomy";

const EXPECTED_TOPIC_IDS = [
  "trading-rules",
  "storage-capacity-compensation",
  "ancillary-services",
  "fourth-regulatory-cycle-grid-cost",
  "storage-operating-costs",
  "green-power-direct-connection",
  "retail-rules",
  "renewable-mechanism-price",
];

describe("China provincial market atlas taxonomy", () => {
  it("defines eight distinct topics and 248 province-topic cells", () => {
    expect(CHINA_MARKET_TOPICS.map((topic) => topic.id)).toEqual(
      EXPECTED_TOPIC_IDS,
    );
    expect(CHINA_MARKET_TOPIC_IDS).toEqual(EXPECTED_TOPIC_IDS);
    expect(new Set(CHINA_MARKET_TOPICS.map((topic) => topic.id)).size).toBe(8);
    expect(31 * CHINA_MARKET_TOPICS.length).toBe(248);
  });

  it("keeps requested subfields and separates revenue from grid cost", () => {
    const topicsById = new Map(
      CHINA_MARKET_TOPICS.map((topic) => [topic.id, topic]),
    );
    const fieldLabels = (topicId: ChinaMarketTopicId) =>
      topicsById.get(topicId)?.fields.map((field) => field.label) ?? [];

    expect(fieldLabels("trading-rules")).toEqual(
      expect.arrayContaining([
        "现货日前规则",
        "现货实时规则",
        "辅助服务交易规则",
        "零售市场规则",
      ]),
    );
    expect(fieldLabels("storage-capacity-compensation")).toEqual(
      expect.arrayContaining([
        "补偿金额",
        "考核机制",
        "补贴时长",
        "等效折算系数",
      ]),
    );
    expect(fieldLabels("fourth-regulatory-cycle-grid-cost")).toEqual(
      expect.arrayContaining(["输配电容量电价", "输配电需量电价", "线损率"]),
    );
    expect(topicsById.get("storage-capacity-compensation")?.title).toContain(
      "收益",
    );
    expect(
      topicsById.get("fourth-regulatory-cycle-grid-cost")?.title,
    ).toContain("用网成本");
  });

  it("uses regions as the only province registry", () => {
    const dataSource = readFileSync(
      fileURLToPath(
        new URL(
          "../../src/lib/china-market/taxonomy.ts",
          import.meta.url,
        ),
      ),
      "utf8",
    );

    expect(dataSource).not.toContain("CHINA_PROVINCES");
    expect(dataSource).not.toContain("tibet");
    expect(dataSource).not.toContain("xizang");
  });

  it("keeps the database topic/field allow-list aligned with the shared taxonomy", () => {
    // Initial seven-topic module plus follow-up enum/field migrations for
    // renewable-mechanism-price (Postgres cannot add + use an enum in one txn).
    const migration = [
      "202607240001_china_province_topic_module.sql",
      "202607280001_add_renewable_mechanism_price_topic.sql",
      "202607280002_renewable_mechanism_price_topic_validation.sql",
    ]
      .map((name) =>
        readFileSync(
          fileURLToPath(
            new URL(`../../supabase/migrations/${name}`, import.meta.url),
          ),
          "utf8",
        ),
      )
      .join("\n");

    for (const topic of CHINA_MARKET_TOPICS) {
      expect(migration).toContain(`'${topic.id}'`);
      for (const field of topic.fields) {
        expect(migration).toContain(`'${field.key}'`);
      }
    }
  });
});
