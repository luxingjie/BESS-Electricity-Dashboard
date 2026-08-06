import { NextResponse } from "next/server";

import {
  adminProvinceTopicsQuerySchema,
  parseApiQuery,
  type AdminProvinceTopicResponse,
  type AdminProvinceTopicsResponse,
} from "@/lib/api/contracts";
import { requireAdminApi } from "@/lib/auth/admin";
import { provinceTopicDraftInputSchema } from "@/lib/china-market/schemas";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { parseWithSchema, readJsonBody } from "@/lib/http/validation";
import { SupabaseProvinceTopicRepository } from "@/lib/repositories/supabase";
import { ProvinceTopicService } from "@/lib/services/province-topic-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminApi();
    const query = parseApiQuery(
      adminProvinceTopicsQuerySchema,
      new URL(request.url).searchParams,
    );
    const client = await createServerSupabaseClient();
    const records = await new SupabaseProvinceTopicRepository(client).listAdmin({
      region_id: query.region_id,
      topic_id: query.topic_id,
      review_status: query.review_status,
    });
    return NextResponse.json({
      data: records,
    } satisfies AdminProvinceTopicsResponse);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedJsonMutation(request);
    const admin = await requireAdminApi();
    const client = await createServerSupabaseClient();
    const service = new ProvinceTopicService(
      new SupabaseProvinceTopicRepository(client),
    );
    const record = await service.saveDraft(
      { id: admin.id, role: "admin" },
      parseWithSchema(
        provinceTopicDraftInputSchema.safeParse(await readJsonBody(request)),
      ),
    );
    return NextResponse.json(
      { data: record } satisfies AdminProvinceTopicResponse,
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
