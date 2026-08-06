import { NextResponse } from "next/server";

import {
  parseApiUuidPath,
  type AdminProvinceTopicResponse,
} from "@/lib/api/contracts";
import { requireAdminApi } from "@/lib/auth/admin";
import { provinceTopicDraftInputSchema } from "@/lib/china-market/schemas";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { parseWithSchema, readJsonBody } from "@/lib/http/validation";
import { SupabaseProvinceTopicRepository } from "@/lib/repositories/supabase";
import { ProvinceTopicService } from "@/lib/services/province-topic-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminApi();
    const id = parseApiUuidPath((await context.params).id);
    const client = await createServerSupabaseClient();
    const record = await new SupabaseProvinceTopicRepository(
      client,
    ).getAdminById(id);
    if (!record) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "省级专题记录不存在" } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      data: record,
    } satisfies AdminProvinceTopicResponse);
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
    const admin = await requireAdminApi();
    const id = parseApiUuidPath((await context.params).id);
    const client = await createServerSupabaseClient();
    const service = new ProvinceTopicService(
      new SupabaseProvinceTopicRepository(client),
    );
    const record = await service.saveDraft(
      { id: admin.id, role: "admin" },
      parseWithSchema(
        provinceTopicDraftInputSchema.safeParse(await readJsonBody(request)),
      ),
      id,
    );
    return NextResponse.json({
      data: record,
    } satisfies AdminProvinceTopicResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
