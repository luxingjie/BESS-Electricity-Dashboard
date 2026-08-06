import { NextResponse } from "next/server";

import { emptyJsonObjectSchema } from "@/lib/api/contracts";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { parseWithSchema, readJsonBody } from "@/lib/http/validation";
import { OpenAiPolicyExtractor } from "@/lib/policy-ingest/ai";
import { PolicyIngestRepository } from "@/lib/policy-ingest/repository";
import { PolicyIngestService } from "@/lib/policy-ingest/service";
import {
  SupabaseRegionRepository,
  SupabaseSignalRepository,
} from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    assertTrustedJsonMutation(request);
    const admin = await requireAdminApi();
    parseWithSchema(
      emptyJsonObjectSchema.safeParse(await readJsonBody(request)),
    );

    const client = await createServerSupabaseClient();
    const service = new PolicyIngestService(
      new PolicyIngestRepository(client),
      new SupabaseSignalRepository(client),
      new SupabaseRegionRepository(client),
      () => new OpenAiPolicyExtractor(),
    );

    const result = await service.run({
      trigger: "manual",
      actorId: admin.id,
    });

    return NextResponse.json({
      data: {
        run: result.run,
        draft_ids: result.draftIds,
        published_ids: result.publishedIds,
        drafts_cleaned: result.draftsCleaned,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
