import { NextResponse } from "next/server";

import {
  adminMarketMetricsQuerySchema,
  parseApiQuery,
  type AdminMarketMetricResponse,
  type AdminMarketMetricsResponse,
} from "@/lib/api/contracts";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { parseWithSchema, readJsonBody } from "@/lib/http/validation";
import { SupabaseMarketMetricRepository } from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { marketMetricCreateSchema } from "@/lib/validation/market-metric";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminApi();
    const client = await createServerSupabaseClient();
    const query = parseApiQuery(
      adminMarketMetricsQuerySchema,
      new URL(request.url).searchParams,
    );
    const metrics = await new SupabaseMarketMetricRepository(client).listAdmin(
      query.region_id,
    );
    return NextResponse.json({
      data: metrics,
    } satisfies AdminMarketMetricsResponse);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedJsonMutation(request);
    await requireAdminApi();
    const payload = parseWithSchema(
      marketMetricCreateSchema.safeParse(await readJsonBody(request)),
    );
    const now = new Date().toISOString();
    const client = await createServerSupabaseClient();
    const metric = await new SupabaseMarketMetricRepository(client).create({
      ...payload,
      created_at: now,
      updated_at: now,
    });
    return NextResponse.json(
      { data: metric } satisfies AdminMarketMetricResponse,
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
