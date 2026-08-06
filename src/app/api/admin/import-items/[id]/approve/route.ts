import { NextResponse } from "next/server";

import { parseApiUuidPath } from "@/lib/api/contracts";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { RequestValidationError, readJsonBody } from "@/lib/http/validation";
import { approveImportItemSchema } from "@/lib/imports/schemas";
import {
  formalDraftData,
  ImportWorkflowError,
} from "@/lib/imports/service";
import { SupabaseImportRepository } from "@/lib/imports/supabase-repository";
import { assertImportDraftApprovable } from "@/lib/imports/validation";
import { SupabaseRegionRepository } from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertTrustedJsonMutation(request);
    await requireAdminApi();
    const payload = approveImportItemSchema.safeParse(await readJsonBody(request));
    if (!payload.success) throw new RequestValidationError(payload.error.flatten());
    if (payload.data.target_type === "unknown") {
      throw new ImportWorkflowError(
        "批准前必须选择 Signal 或 Market Metric",
        "UNKNOWN_TARGET_NOT_APPROVABLE",
      );
    }

    const id = parseApiUuidPath((await context.params).id);
    const client = await createServerSupabaseClient();
    const repository = new SupabaseImportRepository(client);
    const item = await repository.getItem(id);
    if (!item) {
      throw new ImportWorkflowError("导入条目不存在", "IMPORT_ITEM_NOT_FOUND", 404);
    }
    const [job, regions] = await Promise.all([
      repository.getJob(item.import_job_id),
      new SupabaseRegionRepository(client).list(),
    ]);
    if (!job) {
      throw new ImportWorkflowError("导入任务不存在", "IMPORT_JOB_NOT_FOUND", 404);
    }
    const draft = assertImportDraftApprovable({
      inputType: job.input_type,
      targetType: payload.data.target_type,
      draftData: payload.data.draft_data,
      evidence: item.evidence,
      sourceLocation: item.source_location,
      reviewerNote: payload.data.reviewer_note,
      regions,
    });
    if (draft.target_type === "unknown" || !draft.region_code) {
      throw new ImportWorkflowError(
        "导入草稿尚未选择有效地区",
        "REGION_REQUIRED",
      );
    }
    const region = regions.find((candidate) => candidate.code === draft.region_code);
    if (!region) {
      throw new ImportWorkflowError("地区代码不存在", "REGION_NOT_FOUND", 422);
    }
    const result = await repository.approveItem({
      id,
      targetType: payload.data.target_type,
      draftData: formalDraftData(draft, region.id),
      reviewerNote: payload.data.reviewer_note,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
