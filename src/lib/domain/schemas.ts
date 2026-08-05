import { z } from "zod";

import {
  NORMALIZED_STATUSES,
  REGION_TYPES,
  REVIEW_STATUSES,
  SIGNAL_TYPES,
} from "../types";

const emptyStringToNull = (value: unknown): unknown => {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  return value;
};

const nullableText = z.preprocess(
  emptyStringToNull,
  z.string().trim().min(1).nullable(),
);

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Source URL must use HTTP or HTTPS");

const nullableUrl = z.preprocess(
  emptyStringToNull,
  httpUrl.nullable(),
);

const nullableDate = z.preprocess(
  emptyStringToNull,
  z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date")
    .nullable(),
);

export const regionTypeSchema = z.enum(REGION_TYPES);
export const signalTypeSchema = z.enum(SIGNAL_TYPES);
export const reviewStatusSchema = z.enum(REVIEW_STATUSES);
export const normalizedStatusSchema = z.enum(NORMALIZED_STATUSES);

/** Input accepted when an administrator saves an incomplete manual draft. */
export const signalDraftInputSchema = z
  .object({
    region_id: nullableText.optional(),
    signal_type: signalTypeSchema.optional(),
    title: nullableText.optional(),
    summary: nullableText.optional(),
    body: nullableText.optional(),
    category: nullableText.optional(),
    original_status: nullableText.optional(),
    normalized_status: normalizedStatusSchema.nullable().optional(),
    event_date: nullableDate.optional(),
    effective_date: nullableDate.optional(),
    expires_at: nullableDate.optional(),
    impact_channel: nullableText.optional(),
    impact_direction: nullableText.optional(),
    impact_level: nullableText.optional(),
    source_url: nullableUrl.optional(),
    source_name: nullableText.optional(),
    issuer: nullableText.optional(),
    document_id: nullableText.optional(),
    reviewer_note: nullableText.optional(),
    needs_human_review: z.boolean().optional(),
    is_demo: z.boolean().optional(),
  })
  .strict();

/**
 * The publication gate. reviewer_note is the human confirmation text; the
 * service also records reviewer_id and reviewed_at from the authenticated actor.
 */
export const publishableSignalSchema = z.object({
  region_id: z.string().trim().min(1, "Region is required"),
  title: z.string().trim().min(1, "Title is required"),
  summary: z.string().trim().min(1, "Summary is required"),
  source_url: httpUrl,
  normalized_status: normalizedStatusSchema,
  reviewer_note: z.string().trim().min(1, "Human confirmation is required"),
});

export const rejectionInputSchema = z.object({
  reviewer_note: z.string().trim().min(1, "A rejection reason is required"),
});

export type SignalDraftInput = z.input<typeof signalDraftInputSchema>;
export type ParsedSignalDraftInput = z.output<typeof signalDraftInputSchema>;
