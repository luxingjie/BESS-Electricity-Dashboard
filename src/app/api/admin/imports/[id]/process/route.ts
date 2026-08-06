import { NextResponse } from "next/server";

import { parseApiUuidPath } from "@/lib/api/contracts";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { RequestValidationError, readJsonBody } from "@/lib/http/validation";
import { OpenAiStructuredExtractor } from "@/lib/imports/ai";
import { processImportSchema } from "@/lib/imports/schemas";
import { ImportProcessingService } from "@/lib/imports/service";
import { SupabaseImportBlobStore } from "@/lib/imports/storage";
import { SupabaseImportRepository } from "@/lib/imports/supabase-repository";
import { SupabaseRegionRepository } from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertTrustedJsonMutation(request);
    const admin = await requireAdminApi();
    const parsed = processImportSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw new RequestValidationError(parsed.error.flatten());
    const id = parseApiUuidPath((await context.params).id);
    const client = await createServerSupabaseClient();
    const service = new ImportProcessingService(
      new SupabaseImportRepository(client),
      new SupabaseImportBlobStore(client),
      new SupabaseRegionRepository(client),
      () => new OpenAiStructuredExtractor(),
    );
    const result = await service.process(id, admin.id, parsed.data);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
