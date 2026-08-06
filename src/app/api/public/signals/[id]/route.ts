import { NextResponse } from "next/server";

import {
  parseApiUuidPath,
  type PublicSignalResponse,
} from "@/lib/api/contracts";
import { errorResponse } from "@/lib/http/errors";
import { toPublicSignal } from "@/lib/http/public-signal";
import { SupabaseSignalRepository } from "@/lib/repositories/supabase";
import { SignalService } from "@/lib/services/signal-service";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!getSupabaseConfig()) return NextResponse.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 });
    const id = parseApiUuidPath((await context.params).id);
    const client = await createServerSupabaseClient();
    const signal = await new SignalService(new SupabaseSignalRepository(client)).getPublicById(id);
    if (!signal) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Signal 不存在" } }, { status: 404 });
    return NextResponse.json({
      data: toPublicSignal(signal),
    } satisfies PublicSignalResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
