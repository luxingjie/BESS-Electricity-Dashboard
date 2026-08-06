import { NextResponse } from "next/server";

import {
  parseApiQuery,
  publicProjectEventsQuerySchema,
  type PublicProjectEventsResponse,
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
      publicProjectEventsQuerySchema,
      new URL(request.url).searchParams,
    );

    const client = await createServerSupabaseClient();
    const repository = new SupabaseBessProjectEventRepository(client);
    const result = await repository.listPublicPage(query);

    return NextResponse.json({
      data: result,
    } satisfies PublicProjectEventsResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
