import { NextResponse } from "next/server";

import { isValidDateParam } from "@/lib/bess-projects/period";
import { errorResponse } from "@/lib/http/errors";
import { SupabaseBessProjectEventRepository } from "@/lib/repositories/supabase";
import type { BessProjectEventType } from "@/lib/types";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const EVENT_TYPES = new Set(["tender", "award", "commissioning"]);

export async function GET(request: Request) {
  try {
    if (!getSupabaseConfig()) {
      return NextResponse.json(
        { error: { code: "NOT_CONFIGURED" } },
        { status: 503 },
      );
    }

    const url = new URL(request.url);
    const eventTypeRaw = url.searchParams.get("event_type");
    const eventType =
      eventTypeRaw && EVENT_TYPES.has(eventTypeRaw)
        ? (eventTypeRaw as BessProjectEventType)
        : undefined;
    const regionIdsParam = url.searchParams.get("region_ids");
    const regionIds = regionIdsParam
      ? regionIdsParam.split(",").map((item) => item.trim()).filter(Boolean)
      : undefined;
    const dateFromRaw = url.searchParams.get("date_from");
    const dateToRaw = url.searchParams.get("date_to");

    const client = await createServerSupabaseClient();
    const repository = new SupabaseBessProjectEventRepository(client);
    const data = await repository.listPublicAnalytics({
      event_type: eventType,
      province_label: url.searchParams.get("province") || undefined,
      scene: url.searchParams.get("scene") || undefined,
      plant_type: url.searchParams.get("plant_type") || undefined,
      search: url.searchParams.get("q") || undefined,
      region_ids: regionIds,
      include_unknown: url.searchParams.get("include_unknown") !== "0",
      date_from: isValidDateParam(dateFromRaw) ? dateFromRaw : undefined,
      date_to: isValidDateParam(dateToRaw) ? dateToRaw : undefined,
    });

    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}
