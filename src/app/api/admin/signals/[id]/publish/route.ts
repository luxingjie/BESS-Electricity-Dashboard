import { NextResponse } from "next/server";

import {
  parseApiUuidPath,
  reviewTransitionBodySchema,
  type AdminSignalResponse,
} from "@/lib/api/contracts";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { parseWithSchema, readJsonBody } from "@/lib/http/validation";
import { SupabaseSignalRepository } from "@/lib/repositories/supabase";
import { SignalService } from "@/lib/services/signal-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertTrustedJsonMutation(request);
    const admin = await requireAdminApi();
    const id = parseApiUuidPath((await context.params).id);
    const payload = parseWithSchema(
      reviewTransitionBodySchema.safeParse(await readJsonBody(request)),
    );
    const client = await createServerSupabaseClient();
    const service = new SignalService(new SupabaseSignalRepository(client));
    const signal = await service.publish(
      { id: admin.id, role: "admin" },
      id,
      payload.reviewer_note,
    );
    return NextResponse.json({ data: signal } satisfies AdminSignalResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
