import { z } from "zod";

import { isHttpUrl } from "@/lib/validation/http-url";

import {
  IMPORT_INPUT_TYPES,
  IMPORT_TARGET_TYPES,
} from "@/lib/imports/types";
import {
  NORMALIZED_STATUSES,
  SIGNAL_TYPES,
} from "@/lib/types";

const nullableText = z.string().trim().min(1).max(20_000).nullable();
const nullableShortText = z.string().trim().min(1).max(500).nullable();
const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(4_096)
  .refine(isHttpUrl, "URL 必须使用 HTTP 或 HTTPS");

export const importEvidenceSchema = z
  .object({
    field: z.string().trim().min(1).max(120),
    location: z.string().trim().min(1).max(500),
    page: z.number().int().positive().nullable(),
    sheet: z.string().trim().min(1).max(255).nullable(),
    row: z.number().int().positive().nullable(),
    quote: z.string().trim().min(1).max(2_000),
  })
  .strict();

const sharedAiFields = {
  is_relevant: z.boolean(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(importEvidenceSchema).max(50),
  warnings: z.array(z.string().trim().min(1).max(1_000)).max(50),
};

export const signalImportDraftSchema = z
  .object({
    target_type: z.literal("signal"),
    ...sharedAiFields,
    region_code: nullableShortText,
    signal_type: z.enum(SIGNAL_TYPES),
    title: nullableShortText,
    summary: nullableText,
    category: nullableShortText,
    original_status: nullableShortText,
    normalized_status: z.enum(NORMALIZED_STATUSES).nullable(),
    event_date: nullableDate,
    effective_date: nullableDate,
    impact_channel: nullableShortText,
    impact_direction: nullableShortText,
    impact_level: nullableShortText,
    source_name: nullableShortText,
    source_url: httpUrlSchema.nullable(),
  })
  .strict();

export const marketMetricImportDraftSchema = z
  .object({
    target_type: z.literal("market_metric"),
    ...sharedAiFields,
    region_code: nullableShortText,
    metric_key: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9_\-]{0,119}$/)
      .nullable(),
    label: nullableShortText,
    value: z.number().finite().nullable(),
    unit: nullableShortText,
    period_label: nullableShortText,
    as_of_date: nullableDate,
    source_name: nullableShortText,
    source_url: httpUrlSchema.nullable(),
    notes: nullableText,
  })
  .strict();

export const unknownImportDraftSchema = z
  .object({
    target_type: z.literal("unknown"),
    ...sharedAiFields,
    reason: nullableText,
  })
  .strict();

export const structuredImportDraftSchema = z.discriminatedUnion(
  "target_type",
  [
    signalImportDraftSchema,
    marketMetricImportDraftSchema,
    unknownImportDraftSchema,
  ],
);

export const aiImportResponseSchema = z
  .object({
    items: z.array(structuredImportDraftSchema).min(1).max(20),
    warnings: z.array(z.string().trim().min(1).max(1_000)).max(50),
  })
  .strict();

export const excelMappingSuggestionSchema = z
  .object({
    sheet_name: z.string().trim().min(1).max(255),
    target_type: z.enum(["signal", "market_metric"]),
    header_row: z.number().int().positive(),
    mappings: z
      .array(
        z
          .object({
            target_field: z.string().trim().min(1).max(120),
            source_header: z.string().trim().min(1).max(500).nullable(),
          })
          .strict(),
      )
      .max(40),
    confidence: z.number().min(0).max(1),
    warnings: z.array(z.string().trim().min(1).max(1_000)).max(50),
  })
  .strict();

export const createUrlImportSchema = z
  .object({
    input_type: z.literal("url"),
    source_url: httpUrlSchema,
  })
  .strict();

export const importInputTypeSchema = z.enum(IMPORT_INPUT_TYPES);
export const importTargetTypeSchema = z.enum(IMPORT_TARGET_TYPES);

export const processImportSchema = z
  .object({
    sheet_name: z.string().trim().min(1).max(255).optional(),
    target_type: z.enum(["signal", "market_metric"]).optional(),
    mapping: z.record(z.string(), z.string().trim().min(1).nullable()).optional(),
  })
  .strict();

export const suggestMappingSchema = z
  .object({
    sheet_name: z.string().trim().min(1).max(255),
    target_type: z.enum(["signal", "market_metric"]),
  })
  .strict();

export const updateImportItemSchema = z
  .object({
    target_type: importTargetTypeSchema,
    draft_data: z.record(z.string(), z.unknown()),
    reviewer_note: z.string().trim().max(4_000).nullable().optional(),
  })
  .strict();

export const approveImportItemSchema = updateImportItemSchema.extend({
  reviewer_note: z.string().trim().min(1).max(4_000),
});

export const rejectImportItemSchema = z
  .object({
    reviewer_note: z.string().trim().min(1).max(4_000),
  })
  .strict();

export type AiImportResponse = z.infer<typeof aiImportResponseSchema>;
export type ExcelMappingSuggestion = z.infer<
  typeof excelMappingSuggestionSchema
>;
