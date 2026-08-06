import { NextResponse } from "next/server";

import {
  parseApiQuery,
  publicProjectAnalyticsQuerySchema,
  type PublicProjectAnalyticsResponse,
} from "@/lib/api/contracts";
import { errorResponse } from "@/lib/http/errors";
import { SupabaseBessProjectEventRepository } from "@/lib/repositories/supabase";
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
      publicProjectAnalyticsQuerySchema,
      new URL(request.url).searchParams,
    );

    const client = await createServerSupabaseClient();
    const repository = new SupabaseBessProjectEventRepository(client);
    const data = await repository.listPublicAnalytics(query);

    return NextResponse.json({
      data,
    } satisfies PublicProjectAnalyticsResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
