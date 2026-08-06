import { NextResponse } from "next/server";

import {
  adminSignalsQuerySchema,
  parseApiQuery,
  type AdminSignalResponse,
  type AdminSignalsResponse,
} from "@/lib/api/contracts";
import { requireAdminApi } from "@/lib/auth/admin";
import { signalDraftInputSchema } from "@/lib/domain/schemas";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { parseWithSchema, readJsonBody } from "@/lib/http/validation";
import { SupabaseSignalRepository } from "@/lib/repositories/supabase";
import { SignalService } from "@/lib/services/signal-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminApi();
    const query = parseApiQuery(
      adminSignalsQuerySchema,
      new URL(request.url).searchParams,
    );
    const client = await createServerSupabaseClient();
    const repository = new SupabaseSignalRepository(client);
    const signals = await repository.listAdmin({
      region_id: query.region_id,
      review_status: query.review_status,
      search: query.q,
    });
    return NextResponse.json({ data: signals } satisfies AdminSignalsResponse);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedJsonMutation(request);
    const admin = await requireAdminApi();
    const payload = parseWithSchema(
      signalDraftInputSchema.safeParse(await readJsonBody(request)),
    );
    const client = await createServerSupabaseClient();
    const service = new SignalService(new SupabaseSignalRepository(client));
    const signal = await service.saveDraft({ id: admin.id, role: "admin" }, payload);
    return NextResponse.json(
      { data: signal } satisfies AdminSignalResponse,
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
