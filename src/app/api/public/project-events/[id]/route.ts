import { NextResponse } from "next/server";

import {
  parseApiUuidPath,
  type PublicProjectEventResponse,
} from "@/lib/api/contracts";
import { errorResponse } from "@/lib/http/errors";
import { SupabaseBessProjectEventRepository } from "@/lib/repositories/supabase";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!getSupabaseConfig()) {
      return NextResponse.json(
        { error: { code: "NOT_CONFIGURED" } },
        { status: 503 },
      );
    }

    const id = parseApiUuidPath((await context.params).id);

    const client = await createServerSupabaseClient();
    const repository = new SupabaseBessProjectEventRepository(client);
    const data = await repository.getPublicById(id);
    if (!data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data } satisfies PublicProjectEventResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
