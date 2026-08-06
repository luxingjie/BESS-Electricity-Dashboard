import { z } from "zod";

import { isHttpUrl } from "@/lib/validation/http-url";

import { CHINA_MARKET_TOPIC_IDS } from "./taxonomy";
import {
  PROVINCE_TOPIC_FIELD_COVERAGE_STATUSES,
  PROVINCE_TOPIC_LEGAL_STATUSES,
  PROVINCE_TOPIC_OPERATIONAL_STATUSES,
} from "../types";

const emptyStringToNull = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? null : value;

const nullableText = z.preprocess(
  emptyStringToNull,
  z.string().trim().min(1).nullable(),
);

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期必须为 YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "日期不存在");

const nullableDate = z.preprocess(
  emptyStringToNull,
  dateOnly.nullable(),
);

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine(isHttpUrl, "来源链接必须使用 HTTP 或 HTTPS");

const nullableUrl = z.preprocess(emptyStringToNull, httpUrl.nullable());

const nullableNumber = z.preprocess(
  emptyStringToNull,
  z.number().finite().nullable(),
);

export const provinceTopicFieldDraftSchema = z
  .object({
    field_key: z.string().trim().min(1),
    value_text: nullableText,
    value_numeric: nullableNumber,
    unit: nullableText,
    coverage_status: z.enum(PROVINCE_TOPIC_FIELD_COVERAGE_STATUSES),
    applicability: nullableText,
    source_url: nullableUrl,
    source_name: nullableText,
    source_locator: nullableText,
    evidence_excerpt: nullableText,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.coverage_status === "available" &&
      !value.value_text?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["value_text"],
        message: "选择已有数据时必须填写原始展示值",
      });
    }
  });

export const provinceTopicDraftInputSchema = z
  .object({
    region_id: z.string().uuid("请选择有效的省级地区"),
    topic_id: z.enum(CHINA_MARKET_TOPIC_IDS),
    title: nullableText,
    summary: nullableText,
    legal_status: z.enum(PROVINCE_TOPIC_LEGAL_STATUSES).nullable(),
    operational_status: z
      .enum(PROVINCE_TOPIC_OPERATIONAL_STATUSES)
      .nullable(),
    valid_from: nullableDate,
    valid_to: nullableDate,
    as_of_date: nullableDate,
    source_url: nullableUrl,
    source_name: nullableText,
    source_published_at: nullableDate,
    reviewer_note: nullableText,
    is_demo: z.boolean(),
    fields: z.array(provinceTopicFieldDraftSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.valid_from &&
      value.valid_to &&
      value.valid_from > value.valid_to
    ) {
      context.addIssue({
        code: "custom",
        path: ["valid_to"],
        message: "有效期结束日不能早于开始日",
      });
    }
  });

export type ProvinceTopicDraftInput = z.input<
  typeof provinceTopicDraftInputSchema
>;
export type ParsedProvinceTopicDraftInput = z.output<
  typeof provinceTopicDraftInputSchema
>;
