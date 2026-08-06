import { z } from "zod";

import { CHINA_MARKET_TOPIC_IDS } from "@/lib/china-market/taxonomy";
import {
  REVIEW_STATUSES,
  type ChinaCfdAuction,
  type MarketMetric,
  type ProvinceTopicRecord,
  type ProvinceTopicRecordWithFields,
  type PublicBessProjectEvent,
  type PublicProvinceTopicRecordWithFields,
  type Region,
  type Signal,
} from "@/lib/types";
import type { BessProjectAnalytics } from "@/lib/bess-projects/analytics";
import type {
  PublicBessProjectEventPage,
  PublicBessProjectEventQuery,
} from "@/lib/repositories/contracts";

/**
 * Canonical frontend <-> backend HTTP contract.
 *
 * Rules:
 * - Every JSON success is `{ data: T }`.
 * - Every JSON failure is `{ error: { code, message?, issues?, fields? } }`.
 * - Public DTOs never contain Auth identifiers or importer-only raw metadata.
 * - Missing numeric facts remain `null`; clients must not coerce them to zero.
 * - Admin JSON mutations require an admin session and same-origin JSON request.
 */

export type ApiSuccess<T> = { data: T };

export type ApiFailure = {
  error: {
    code: string;
    message?: string;
    issues?: unknown;
    fields?: Record<string, string[]>;
  };
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type PublicSignalDto = ReturnType<
  typeof import("@/lib/http/public-signal").toPublicSignal
>;

export type PublicRegionsResponse = ApiSuccess<Region[]>;
export type PublicSignalsResponse = ApiSuccess<PublicSignalDto[]>;
export type PublicSignalResponse = ApiSuccess<PublicSignalDto>;
export type PublicMarketMetricsResponse = ApiSuccess<MarketMetric[]>;
export type PublicProvinceTopicsResponse = ApiSuccess<
  PublicProvinceTopicRecordWithFields[]
>;
export type PublicProjectEventsResponse =
  ApiSuccess<PublicBessProjectEventPage>;
export type PublicProjectEventResponse = ApiSuccess<PublicBessProjectEvent>;
export type PublicProjectAnalyticsResponse =
  ApiSuccess<BessProjectAnalytics>;

export type AdminSignalsResponse = ApiSuccess<Signal[]>;
export type AdminSignalResponse = ApiSuccess<Signal>;
export type AdminMarketMetricsResponse = ApiSuccess<MarketMetric[]>;
export type AdminMarketMetricResponse = ApiSuccess<MarketMetric>;
export type AdminCfdAuctionsResponse = ApiSuccess<ChinaCfdAuction[]>;
export type AdminCfdAuctionResponse = ApiSuccess<ChinaCfdAuction>;
export type AdminProvinceTopicsResponse = ApiSuccess<ProvinceTopicRecord[]>;
export type AdminProvinceTopicResponse = ApiSuccess<
  ProvinceTopicRecordWithFields
>;

export const API_PATHS = {
  public: {
    regions: "/api/public/regions",
    signals: "/api/public/signals",
    signal: (id: string) => `/api/public/signals/${encodeURIComponent(id)}`,
    marketMetrics: "/api/public/market-metrics",
    provinceTopics: "/api/public/province-topics",
    projectEvents: "/api/public/project-events",
    projectEvent: (id: string) =>
      `/api/public/project-events/${encodeURIComponent(id)}`,
    projectEventAnalytics: "/api/public/project-events/analytics",
  },
  admin: {
    signals: "/api/admin/signals",
    signal: (id: string) => `/api/admin/signals/${encodeURIComponent(id)}`,
    signalPublish: (id: string) =>
      `/api/admin/signals/${encodeURIComponent(id)}/publish`,
    signalReject: (id: string) =>
      `/api/admin/signals/${encodeURIComponent(id)}/reject`,
    marketMetrics: "/api/admin/market-metrics",
    marketMetric: (id: string) =>
      `/api/admin/market-metrics/${encodeURIComponent(id)}`,
    cfdAuctions: "/api/admin/cfd-auctions",
    cfdAuction: (id: string) =>
      `/api/admin/cfd-auctions/${encodeURIComponent(id)}`,
    provinceTopics: "/api/admin/province-topics",
    provinceTopic: (id: string) =>
      `/api/admin/province-topics/${encodeURIComponent(id)}`,
    provinceTopicPublish: (id: string) =>
      `/api/admin/province-topics/${encodeURIComponent(id)}/publish`,
    provinceTopicReject: (id: string) =>
      `/api/admin/province-topics/${encodeURIComponent(id)}/reject`,
    imports: "/api/admin/imports",
    importProcess: (id: string) =>
      `/api/admin/imports/${encodeURIComponent(id)}/process`,
    importSuggestMapping: (id: string) =>
      `/api/admin/imports/${encodeURIComponent(id)}/suggest-mapping`,
    importItem: (id: string) =>
      `/api/admin/import-items/${encodeURIComponent(id)}`,
    importItemApprove: (id: string) =>
      `/api/admin/import-items/${encodeURIComponent(id)}/approve`,
    importItemReject: (id: string) =>
      `/api/admin/import-items/${encodeURIComponent(id)}/reject`,
    policyIngestRun: "/api/admin/policy-ingest/run",
  },
  cron: {
    policyIngest: "/api/cron/policy-ingest",
  },
} as const;

export const API_ENDPOINT_CONTRACTS = [
  { path: "/api/public/regions", methods: ["GET"], auth: "public" },
  { path: "/api/public/signals", methods: ["GET"], auth: "public" },
  { path: "/api/public/signals/{id}", methods: ["GET"], auth: "public" },
  {
    path: "/api/public/market-metrics",
    methods: ["GET"],
    auth: "public",
  },
  {
    path: "/api/public/province-topics",
    methods: ["GET"],
    auth: "public",
  },
  {
    path: "/api/public/project-events",
    methods: ["GET"],
    auth: "public",
  },
  {
    path: "/api/public/project-events/{id}",
    methods: ["GET"],
    auth: "public",
  },
  {
    path: "/api/public/project-events/analytics",
    methods: ["GET"],
    auth: "public",
  },
  { path: "/api/admin/signals", methods: ["GET", "POST"], auth: "admin" },
  {
    path: "/api/admin/signals/{id}",
    methods: ["GET", "PATCH"],
    auth: "admin",
  },
  {
    path: "/api/admin/signals/{id}/publish",
    methods: ["POST"],
    auth: "admin",
  },
  {
    path: "/api/admin/signals/{id}/reject",
    methods: ["POST"],
    auth: "admin",
  },
  {
    path: "/api/admin/market-metrics",
    methods: ["GET", "POST"],
    auth: "admin",
  },
  {
    path: "/api/admin/market-metrics/{id}",
    methods: ["GET", "PATCH"],
    auth: "admin",
  },
  {
    path: "/api/admin/cfd-auctions",
    methods: ["GET", "POST"],
    auth: "admin",
  },
  {
    path: "/api/admin/cfd-auctions/{id}",
    methods: ["GET", "PATCH"],
    auth: "admin",
  },
  {
    path: "/api/admin/province-topics",
    methods: ["GET", "POST"],
    auth: "admin",
  },
  {
    path: "/api/admin/province-topics/{id}",
    methods: ["GET", "PATCH"],
    auth: "admin",
  },
  {
    path: "/api/admin/province-topics/{id}/publish",
    methods: ["POST"],
    auth: "admin",
  },
  {
    path: "/api/admin/province-topics/{id}/reject",
    methods: ["POST"],
    auth: "admin",
  },
  { path: "/api/admin/imports", methods: ["GET", "POST"], auth: "admin" },
  {
    path: "/api/admin/imports/{id}/process",
    methods: ["POST"],
    auth: "admin",
  },
  {
    path: "/api/admin/imports/{id}/suggest-mapping",
    methods: ["POST"],
    auth: "admin",
  },
  {
    path: "/api/admin/import-items/{id}",
    methods: ["PATCH"],
    auth: "admin",
  },
  {
    path: "/api/admin/import-items/{id}/approve",
    methods: ["POST"],
    auth: "admin",
  },
  {
    path: "/api/admin/import-items/{id}/reject",
    methods: ["POST"],
    auth: "admin",
  },
  {
    path: "/api/admin/policy-ingest/run",
    methods: ["POST"],
    auth: "admin",
  },
  {
    path: "/api/cron/policy-ingest",
    methods: ["GET", "POST"],
    auth: "cron-secret",
  },
] as const;

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().min(1).max(max).optional());

const optionalUuid = z.preprocess(
  emptyToUndefined,
  z.string().uuid().optional(),
);

function isRealIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const optionalIsoDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine(isRealIsoDate, "日期必须是有效的 YYYY-MM-DD")
    .optional(),
);

const optionalRegionIds = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().uuid()).min(1).max(100))
    .optional(),
);

const includeUnknown = z.preprocess(
  emptyToUndefined,
  z
    .enum(["0", "1"])
    .default("1")
    .transform((value) => value === "1"),
);

const projectFilterShape = {
  event_type: z.enum(["tender", "award", "commissioning"]).optional(),
  province: optionalText(200),
  scene: optionalText(200),
  plant_type: optionalText(200),
  q: optionalText(200),
  region_ids: optionalRegionIds,
  include_unknown: includeUnknown,
  date_from: optionalIsoDate,
  date_to: optionalIsoDate,
};

function validateDateRange(
  value: { date_from?: string; date_to?: string },
  context: z.RefinementCtx,
) {
  if (value.date_from && value.date_to && value.date_from > value.date_to) {
    context.addIssue({
      code: "custom",
      path: ["date_to"],
      message: "date_to 不能早于 date_from",
    });
  }
}

export const publicProjectEventsQuerySchema = z
  .object({
    ...projectFilterShape,
    page: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).default(1),
    ),
    page_size: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(30).default(15),
    ),
  })
  .strict()
  .superRefine(validateDateRange)
  .transform(
    (value): PublicBessProjectEventQuery => ({
      event_type: value.event_type,
      province_label: value.province,
      scene: value.scene,
      plant_type: value.plant_type,
      search: value.q,
      region_ids: value.region_ids,
      include_unknown: value.include_unknown,
      date_from: value.date_from,
      date_to: value.date_to,
      page: value.page,
      page_size: value.page_size,
    }),
  );

export const publicProjectAnalyticsQuerySchema = z
  .object(projectFilterShape)
  .strict()
  .superRefine(validateDateRange)
  .transform(
    (value): PublicBessProjectEventQuery => ({
      event_type: value.event_type,
      province_label: value.province,
      scene: value.scene,
      plant_type: value.plant_type,
      search: value.q,
      region_ids: value.region_ids,
      include_unknown: value.include_unknown,
      date_from: value.date_from,
      date_to: value.date_to,
    }),
  );

export const publicSignalsQuerySchema = z
  .object({
    region_id: optionalUuid,
    scope: z.preprocess(
      emptyToUndefined,
      z.enum(["descendants"]).optional(),
    ),
    q: optionalText(200),
    limit: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(100).default(100),
    ),
  })
  .strict();

export const publicRegionScopedQuerySchema = z
  .object({
    region_id: optionalUuid,
    scope: z.preprocess(
      emptyToUndefined,
      z.enum(["descendants"]).optional(),
    ),
  })
  .strict();

export const publicProvinceTopicsQuerySchema = publicRegionScopedQuerySchema
  .extend({
    topic_id: z.preprocess(
      emptyToUndefined,
      z.enum(CHINA_MARKET_TOPIC_IDS).optional(),
    ),
  })
  .strict();

export const adminSignalsQuerySchema = z
  .object({
    region_id: optionalUuid,
    review_status: z.preprocess(
      emptyToUndefined,
      z.enum(REVIEW_STATUSES).optional(),
    ),
    q: optionalText(200),
  })
  .strict();

export const adminMarketMetricsQuerySchema = z
  .object({ region_id: optionalUuid })
  .strict();

export const adminProvinceTopicsQuerySchema = z
  .object({
    region_id: optionalUuid,
    topic_id: z.preprocess(
      emptyToUndefined,
      z.enum(CHINA_MARKET_TOPIC_IDS).optional(),
    ),
    review_status: z.preprocess(
      emptyToUndefined,
      z.enum(REVIEW_STATUSES).optional(),
    ),
  })
  .strict();

export const emptyJsonObjectSchema = z.object({}).strict();
export const reviewTransitionBodySchema = z
  .object({ reviewer_note: z.string().max(4_000) })
  .strict();
const uuidPathParamSchema = z.string().uuid();

export class ApiContractValidationError extends Error {
  readonly status = 422;
  readonly code: "INVALID_QUERY" | "INVALID_PATH";
  readonly issues: unknown;

  constructor(
    code: "INVALID_QUERY" | "INVALID_PATH",
    issues: unknown,
  ) {
    super(code === "INVALID_PATH" ? "路径参数不符合接口契约" : "查询参数不符合接口契约");
    this.code = code;
    this.issues = issues;
  }
}

export function parseApiQuery<T>(
  schema: z.ZodType<T>,
  searchParams: URLSearchParams,
): T {
  const input = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiContractValidationError(
      "INVALID_QUERY",
      result.error.flatten(),
    );
  }
  return result.data;
}

export function parseApiUuidPath(value: string): string {
  const result = uuidPathParamSchema.safeParse(value);
  if (!result.success) {
    throw new ApiContractValidationError(
      "INVALID_PATH",
      result.error.flatten(),
    );
  }
  return result.data;
}
