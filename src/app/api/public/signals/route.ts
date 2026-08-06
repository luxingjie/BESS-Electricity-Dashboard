import { NextResponse } from "next/server";

import {
  parseApiQuery,
  publicSignalsQuerySchema,
  type PublicSignalsResponse,
} from "@/lib/api/contracts";
import { errorResponse } from "@/lib/http/errors";
import { resolvePublicRegionQuery } from "@/lib/http/public-region-scope";
import { toPublicSignal } from "@/lib/http/public-signal";
import {
  SupabaseRegionRepository,
  SupabaseSignalRepository,
} from "@/lib/repositories/supabase";
import { SignalService } from "@/lib/services/signal-service";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!getSupabaseConfig()) return NextResponse.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 });
    const query = parseApiQuery(
      publicSignalsQuerySchema,
      new URL(request.url).searchParams,
    );
    const client = await createServerSupabaseClient();
    const regionQuery = await resolvePublicRegionQuery(
      query.region_id,
      query.scope ?? null,
      new SupabaseRegionRepository(client),
    );
    const service = new SignalService(new SupabaseSignalRepository(client));
    const signals = await service.listPublic({
      ...regionQuery,
      search: query.q,
      limit: query.limit,
    });
    return NextResponse.json({
      data: signals.map(toPublicSignal),
    } satisfies PublicSignalsResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
