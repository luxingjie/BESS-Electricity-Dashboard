import { NextResponse } from "next/server";

import { parseApiUuidPath } from "@/lib/api/contracts";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { RequestValidationError, readJsonBody } from "@/lib/http/validation";
import {
  structuredImportDraftSchema,
  updateImportItemSchema,
} from "@/lib/imports/schemas";
import { ImportWorkflowError } from "@/lib/imports/service";
import { SupabaseImportRepository } from "@/lib/imports/supabase-repository";
import type { JsonObject } from "@/lib/imports/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertTrustedJsonMutation(request);
    await requireAdminApi();
    const payload = updateImportItemSchema.safeParse(await readJsonBody(request));
    if (!payload.success) throw new RequestValidationError(payload.error.flatten());
    const draft = structuredImportDraftSchema.safeParse(payload.data.draft_data);
    if (!draft.success) throw new RequestValidationError(draft.error.flatten());
    if (draft.data.target_type !== payload.data.target_type) {
      throw new ImportWorkflowError(
        "target_type 与 draft_data 不一致",
        "IMPORT_TARGET_MISMATCH",
      );
    }

    const id = parseApiUuidPath((await context.params).id);
    const client = await createServerSupabaseClient();
    const repository = new SupabaseImportRepository(client);
    const existing = await repository.getItem(id);
    if (!existing) {
      throw new ImportWorkflowError("导入条目不存在", "IMPORT_ITEM_NOT_FOUND", 404);
    }
    const item = await repository.updateItem(id, {
      target_type: payload.data.target_type,
      draft_data: draft.data as unknown as JsonObject,
      reviewer_note: payload.data.reviewer_note ?? null,
      review_status: "pending_review",
    });
    return NextResponse.json({ data: item });
  } catch (error) {
    return errorResponse(error);
  }
}
