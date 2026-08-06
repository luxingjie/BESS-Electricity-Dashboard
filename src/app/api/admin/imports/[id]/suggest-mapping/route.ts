import { NextResponse } from "next/server";

import { parseApiUuidPath } from "@/lib/api/contracts";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { RequestValidationError, readJsonBody } from "@/lib/http/validation";
import { OpenAiStructuredExtractor } from "@/lib/imports/ai";
import { suggestMappingSchema } from "@/lib/imports/schemas";
import { ImportProcessingService } from "@/lib/imports/service";
import { SupabaseImportBlobStore } from "@/lib/imports/storage";
import { SupabaseImportRepository } from "@/lib/imports/supabase-repository";
import { SupabaseRegionRepository } from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertTrustedJsonMutation(request);
    const admin = await requireAdminApi();
    const parsed = suggestMappingSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw new RequestValidationError(parsed.error.flatten());
    const id = parseApiUuidPath((await context.params).id);
    const client = await createServerSupabaseClient();
    const service = new ImportProcessingService(
      new SupabaseImportRepository(client),
      new SupabaseImportBlobStore(client),
      new SupabaseRegionRepository(client),
      () => new OpenAiStructuredExtractor(),
    );
    const suggestion = await service.suggestMapping({
      jobId: id,
      sheetName: parsed.data.sheet_name,
      targetType: parsed.data.target_type,
      adminId: admin.id,
    });
    return NextResponse.json({ data: suggestion });
  } catch (error) {
    return errorResponse(error);
  }
}
