import { NextResponse } from "next/server";

import {
  parseApiUuidPath,
  type AdminCfdAuctionResponse,
} from "@/lib/api/contracts";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { parseWithSchema, readJsonBody } from "@/lib/http/validation";
import { SupabaseCfdAuctionRepository } from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cfdAuctionUpdateSchema } from "@/lib/validation/cfd-auction";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminApi();
    const id = parseApiUuidPath((await context.params).id);
    const client = await createServerSupabaseClient();
    const auction = await new SupabaseCfdAuctionRepository(client).getAdminById(id);
    if (!auction) return NextResponse.json({ error: { code: "NOT_FOUND", message: "竞价记录不存在" } }, { status: 404 });
    return NextResponse.json({
      data: auction,
    } satisfies AdminCfdAuctionResponse);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertTrustedJsonMutation(request);
    await requireAdminApi();
    const id = parseApiUuidPath((await context.params).id);
    const payload = parseWithSchema(
      cfdAuctionUpdateSchema.safeParse(await readJsonBody(request)),
    );
    const client = await createServerSupabaseClient();
    const auction = await new SupabaseCfdAuctionRepository(client).update(id, {
      ...payload,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({
      data: auction,
    } satisfies AdminCfdAuctionResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
