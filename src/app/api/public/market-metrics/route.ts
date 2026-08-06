import { NextResponse } from "next/server";

import {
  parseApiQuery,
  publicRegionScopedQuerySchema,
  type PublicMarketMetricsResponse,
} from "@/lib/api/contracts";
import { errorResponse } from "@/lib/http/errors";
import { resolvePublicRegionQuery } from "@/lib/http/public-region-scope";
import {
  SupabaseMarketMetricRepository,
  SupabaseRegionRepository,
} from "@/lib/repositories/supabase";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!getSupabaseConfig()) return NextResponse.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 });
    const client = await createServerSupabaseClient();
    const query = parseApiQuery(
      publicRegionScopedQuerySchema,
      new URL(request.url).searchParams,
    );
    const regionQuery = await resolvePublicRegionQuery(
      query.region_id,
      query.scope ?? null,
      new SupabaseRegionRepository(client),
    );
    const metrics = await new SupabaseMarketMetricRepository(client).listPublic(regionQuery);
    return NextResponse.json({
      data: metrics,
    } satisfies PublicMarketMetricsResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
