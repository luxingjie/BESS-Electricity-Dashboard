import { z } from "zod";

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const nullableText = z.preprocess(emptyToNull, z.string().trim().min(1).nullable());
const nullableUrl = z.preprocess(emptyToNull, z.string().trim().url().nullable());
const nullableDate = z.preprocess(
  emptyToNull,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期必须为 YYYY-MM-DD").nullable(),
);
const nullableNumber = z.preprocess(
  emptyToNull,
  z.number().finite().nullable(),
);
const nullableInt = z.preprocess(
  emptyToNull,
  z.number().int().nullable(),
);

export const cfdAuctionCreateSchema = z.object({
  region_id: z.string().uuid("请选择有效的省级地区"),
  province_label: z.string().trim().min(1),
  province_label_en: nullableText,
  grid_region: nullableText,
  auction_round: nullableText,
  announcement_date: nullableDate,
  delivery_year: nullableInt,
  commissioning_window: nullableText,
  status: nullableText,
  pot_design: nullableText,
  onshore_wind_floor: nullableNumber,
  onshore_wind_cap: nullableNumber,
  onshore_wind_strike: nullableNumber,
  offshore_wind_floor: nullableNumber,
  offshore_wind_cap: nullableNumber,
  offshore_wind_strike: nullableNumber,
  solar_floor: nullableNumber,
  solar_cap: nullableNumber,
  solar_strike: nullableNumber,
  coal_benchmark: nullableNumber,
  target_volume_gwh: nullableNumber,
  awarded_volume_gwh: nullableNumber,
  subscription_rate: nullableNumber,
  onshore_wind_target_gwh: nullableNumber,
  onshore_wind_awarded_gwh: nullableNumber,
  offshore_wind_target_gwh: nullableNumber,
  offshore_wind_awarded_gwh: nullableNumber,
  solar_target_gwh: nullableNumber,
  solar_awarded_gwh: nullableNumber,
  duration_years_onshore: nullableNumber,
  duration_years_offshore: nullableNumber,
  duration_years_solar: nullableNumber,
  note: nullableText,
  source_url: nullableUrl,
  source_name: nullableText,
  implementation_plan_url: nullableUrl,
  implementation_plan_name: nullableText,
  announcement_url: nullableUrl,
  announcement_name: nullableText,
  supplemental_url: nullableUrl,
  supplemental_name: nullableText,
  legacy_coverage_ratio: nullableNumber,
  legacy_strike: nullableNumber,
  legacy_duration_years: nullableNumber,
  legacy_note: nullableText,
  legacy_url: nullableUrl,
  is_demo: z.boolean(),
  is_published: z.boolean(),
});

export const cfdAuctionUpdateSchema = cfdAuctionCreateSchema.partial();
