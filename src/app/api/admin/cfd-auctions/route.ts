import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { SupabaseCfdAuctionRepository } from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cfdAuctionCreateSchema } from "@/lib/validation/cfd-auction";
import { parseWithSchema } from "@/lib/validation/market-metric";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminApi();
    const client = await createServerSupabaseClient();
    const auctions = await new SupabaseCfdAuctionRepository(client).listAdmin();
    return NextResponse.json({ data: auctions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedJsonMutation(request);
    await requireAdminApi();
    const payload = parseWithSchema(cfdAuctionCreateSchema.safeParse(await request.json()));
    const now = new Date().toISOString();
    const client = await createServerSupabaseClient();
    const auction = await new SupabaseCfdAuctionRepository(client).create({
      ...payload,
      created_at: now,
      updated_at: now,
    });
    return NextResponse.json({ data: auction }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
