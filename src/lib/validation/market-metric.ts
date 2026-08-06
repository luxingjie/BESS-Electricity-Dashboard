import { z } from "zod";

import { isHttpUrl } from "@/lib/validation/http-url";

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const nullableText = z.preprocess(emptyToNull, z.string().trim().min(1).nullable());
const httpUrl = z
  .string()
  .trim()
  .url()
  .refine(isHttpUrl, "来源链接必须使用 HTTP 或 HTTPS");
const nullableUrl = z.preprocess(emptyToNull, httpUrl.nullable());
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
  emptyToNull,
  dateOnly.nullable(),
);

export const marketMetricCreateSchema = z.object({
  region_id: z.string().uuid(),
  metric_key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  value: z.number().finite().nullable(),
  unit: nullableText,
  period_label: nullableText,
  as_of_date: nullableDate,
  source_url: nullableUrl,
  source_name: nullableText,
  notes: nullableText,
  is_demo: z.boolean(),
  is_published: z.boolean(),
}).strict();

export const marketMetricUpdateSchema = marketMetricCreateSchema.partial();
