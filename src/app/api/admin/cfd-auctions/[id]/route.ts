import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { SupabaseCfdAuctionRepository } from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cfdAuctionUpdateSchema } from "@/lib/validation/cfd-auction";
import { parseWithSchema } from "@/lib/validation/market-metric";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminApi();
    const { id } = await context.params;
    const client = await createServerSupabaseClient();
    const auction = await new SupabaseCfdAuctionRepository(client).getAdminById(id);
    if (!auction) return NextResponse.json({ error: { code: "NOT_FOUND", message: "竞价记录不存在" } }, { status: 404 });
    return NextResponse.json({ data: auction });
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
    const { id } = await context.params;
    const payload = parseWithSchema(cfdAuctionUpdateSchema.safeParse(await request.json()));
    const client = await createServerSupabaseClient();
    const auction = await new SupabaseCfdAuctionRepository(client).update(id, {
      ...payload,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ data: auction });
  } catch (error) {
    return errorResponse(error);
  }
}
