import { NextResponse } from "next/server";

import {
  parseApiQuery,
  publicProvinceTopicsQuerySchema,
  type PublicProvinceTopicsResponse,
} from "@/lib/api/contracts";
import { errorResponse } from "@/lib/http/errors";
import { toPublicProvinceTopic } from "@/lib/http/public-province-topic";
import { resolvePublicRegionQuery } from "@/lib/http/public-region-scope";
import {
  SupabaseProvinceTopicRepository,
  SupabaseRegionRepository,
} from "@/lib/repositories/supabase";
import { ProvinceTopicService } from "@/lib/services/province-topic-service";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!getSupabaseConfig()) {
      return NextResponse.json(
        { error: { code: "NOT_CONFIGURED" } },
        { status: 503 },
      );
    }

    const query = parseApiQuery(
      publicProvinceTopicsQuerySchema,
      new URL(request.url).searchParams,
    );
    const client = await createServerSupabaseClient();
    const regionQuery = await resolvePublicRegionQuery(
      query.region_id,
      query.scope ?? null,
      new SupabaseRegionRepository(client),
    );
    const records = await new ProvinceTopicService(
      new SupabaseProvinceTopicRepository(client),
    ).listPublic({ ...regionQuery, topic_id: query.topic_id });
    return NextResponse.json({
      data: records.map(toPublicProvinceTopic),
    } satisfies PublicProvinceTopicsResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
