import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import {
  API_ENDPOINT_CONTRACTS,
  ApiContractValidationError,
  parseApiQuery,
  parseApiUuidPath,
  publicProjectEventsQuerySchema,
  publicProvinceTopicsQuerySchema,
  publicSignalsQuerySchema,
} from "@/lib/api/contracts";
import { provinceTopicDraftInputSchema } from "@/lib/china-market/schemas";
import { signalDraftInputSchema } from "@/lib/domain/schemas";
import { readJsonBody } from "@/lib/http/validation";
import { toPublicBessProjectEvent } from "@/lib/http/public-project-event";
import { toPublicProvinceTopic } from "@/lib/http/public-province-topic";
import { httpUrlSchema } from "@/lib/imports/schemas";
import type {
  BessAwardCandidate,
  BessProjectEvent,
} from "@/lib/types";
import { cfdAuctionCreateSchema } from "@/lib/validation/cfd-auction";
import { marketMetricCreateSchema } from "@/lib/validation/market-metric";

import { makeProvinceTopicRecord } from "../helpers/in-memory-province-topic-repository";

const API_ROOT = join(process.cwd(), "src", "app", "api");

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? routeFiles(path)
      : entry.name === "route.ts"
        ? [path]
        : [];
  });
}

function implementedEndpoints() {
  return routeFiles(API_ROOT).flatMap((file) => {
    const route = relative(API_ROOT, file)
      .split(sep)
      .slice(0, -1)
      .map((part) => part.replace(/^\[(.+)\]$/, "{$1}"))
      .join("/");
    const source = readFileSync(file, "utf8");
    const methods = ["GET", "POST", "PATCH", "PUT", "DELETE"].filter(
      (method) =>
        new RegExp(`export\\s+async\\s+function\\s+${method}\\b`).test(source),
    );
    return methods.map((method) => `${method} /api/${route}`);
  });
}

function contractedEndpoints() {
  return API_ENDPOINT_CONTRACTS.flatMap((endpoint) =>
    endpoint.methods.map((method) => `${method} ${endpoint.path}`),
  );
}

describe("frontend/backend API contract", () => {
  it("lists every implemented route and method exactly once", () => {
    expect(implementedEndpoints().sort()).toEqual(contractedEndpoints().sort());
  });

  it("parses the project list query into repository semantics", () => {
    const query = parseApiQuery(
      publicProjectEventsQuerySchema,
      new URLSearchParams({
        event_type: "award",
        region_ids:
          "11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222",
        include_unknown: "0",
        date_from: "2026-01-01",
        date_to: "2026-12-31",
        page: "2",
        page_size: "30",
      }),
    );

    expect(query).toMatchObject({
      event_type: "award",
      include_unknown: false,
      date_from: "2026-01-01",
      date_to: "2026-12-31",
      page: 2,
      page_size: 30,
    });
    expect(query.region_ids).toHaveLength(2);
  });

  it.each([
    ["bad event type", { event_type: "all" }],
    ["bad page", { page: "0" }],
    ["bad page size", { page_size: "31" }],
    ["bad region id", { region_ids: "not-a-uuid" }],
    ["nonexistent date", { date_from: "2026-02-30" }],
    [
      "reversed range",
      { date_from: "2026-12-31", date_to: "2026-01-01" },
    ],
  ])("rejects %s before a database query", (_label, input) => {
    expect(() =>
      parseApiQuery(
        publicProjectEventsQuerySchema,
        new URLSearchParams(input),
      ),
    ).toThrow(ApiContractValidationError);
  });

  it("accepts all current topic IDs including the eighth topic", () => {
    const query = parseApiQuery(
      publicProvinceTopicsQuerySchema,
      new URLSearchParams({ topic_id: "renewable-mechanism-price" }),
    );
    expect(query.topic_id).toBe("renewable-mechanism-price");
  });

  it("does not silently accept unsupported public filters", () => {
    expect(() =>
      parseApiQuery(
        publicSignalsQuerySchema,
        new URLSearchParams({ scope: "children" }),
      ),
    ).toThrow(ApiContractValidationError);
  });

  it("validates UUID path parameters before repository access", () => {
    expect(
      parseApiUuidPath("11111111-1111-4111-8111-111111111111"),
    ).toBe("11111111-1111-4111-8111-111111111111");
    expect(() => parseApiUuidPath("not-a-uuid")).toThrow(
      ApiContractValidationError,
    );
  });

  it("returns a contract error for malformed JSON instead of treating it as an empty body", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    await expect(readJsonBody(request)).rejects.toMatchObject({
      status: 422,
      code: "INVALID_JSON",
    });
  });

  it("turns malformed URLs into validation failures instead of throwing", () => {
    const objectSchemas = [
      signalDraftInputSchema,
      provinceTopicDraftInputSchema,
      marketMetricCreateSchema,
      cfdAuctionCreateSchema,
    ];

    for (const schema of objectSchemas) {
      expect(() => schema.safeParse({ source_url: "not-a-url" })).not.toThrow();
      expect(schema.safeParse({ source_url: "not-a-url" }).success).toBe(false);
    }
    expect(() => httpUrlSchema.safeParse("not-a-url")).not.toThrow();
    expect(httpUrlSchema.safeParse("not-a-url").success).toBe(false);
  });

  it("strips Auth actor IDs from public province-topic DTOs", () => {
    const dto = toPublicProvinceTopic(makeProvinceTopicRecord());

    expect(dto).not.toHaveProperty("reviewer_id");
    expect(dto).not.toHaveProperty("created_by");
  });

  it("strips importer-only project metadata from the Viewer DTO", () => {
    const event: BessProjectEvent = {
      id: "11111111-1111-4111-8111-111111111111",
      event_type: "award",
      title: "示例中标",
      event_date: "2026-08-01",
      region_id: null,
      province_label: "未知",
      province_raw: null,
      city_raw: null,
      region_bloc: null,
      power_mw: null,
      energy_mwh: 0,
      duration_h: null,
      duration_band: null,
      scale_label: null,
      c_rate: null,
      scene: null,
      plant_type: null,
      technology: null,
      owner_name: null,
      owner_group: null,
      counterparty_name: null,
      scope_label: null,
      status_label: null,
      summary: null,
      budget_wan: null,
      unit_price_cap_yuan_per_wh: null,
      result_date: null,
      source_name: "CESA储能应用分会",
      source_batch: "private-batch",
      source_row_hash: "private-hash",
      raw: { file: "private.xlsx", row: 9 },
      is_demo: false,
      is_published: true,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    };
    const candidate: BessAwardCandidate = {
      id: "22222222-2222-4222-8222-222222222222",
      event_id: event.id,
      rank_label: "第一候选人",
      rank_order: 1,
      candidate_name: "示例公司",
      candidate_group: null,
      bid_amount_wan: 0,
      unit_price_yuan_per_wh: null,
      is_primary: true,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    };

    const dto = toPublicBessProjectEvent(event, [candidate]);
    expect(dto.energy_mwh).toBe(0);
    expect(dto.candidates[0].bid_amount_wan).toBe(0);
    expect(dto).not.toHaveProperty("source_batch");
    expect(dto).not.toHaveProperty("source_row_hash");
    expect(dto).not.toHaveProperty("raw");
    expect(dto).not.toHaveProperty("is_published");
    expect(dto.candidates[0]).not.toHaveProperty("event_id");
  });
});
