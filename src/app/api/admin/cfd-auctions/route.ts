import { NextResponse } from "next/server";

import type {
  AdminCfdAuctionResponse,
  AdminCfdAuctionsResponse,
} from "@/lib/api/contracts";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { parseWithSchema, readJsonBody } from "@/lib/http/validation";
import { SupabaseCfdAuctionRepository } from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cfdAuctionCreateSchema } from "@/lib/validation/cfd-auction";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminApi();
    const client = await createServerSupabaseClient();
    const auctions = await new SupabaseCfdAuctionRepository(client).listAdmin();
    return NextResponse.json({
      data: auctions,
    } satisfies AdminCfdAuctionsResponse);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedJsonMutation(request);
    await requireAdminApi();
    const payload = parseWithSchema(
      cfdAuctionCreateSchema.safeParse(await readJsonBody(request)),
    );
    const now = new Date().toISOString();
    const client = await createServerSupabaseClient();
    const auction = await new SupabaseCfdAuctionRepository(client).create({
      ...payload,
      created_at: now,
      updated_at: now,
    });
    return NextResponse.json(
      { data: auction } satisfies AdminCfdAuctionResponse,
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
