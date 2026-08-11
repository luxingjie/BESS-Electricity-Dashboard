import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedMultipartMutation } from "@/lib/http/security";
import { PolicyInterpretationRepository } from "@/lib/policy-interpretations/repository";
import {
  assertPolicyBriefUpload,
  policyBriefObjectPath,
  SupabasePolicyBriefBlobStore,
} from "@/lib/policy-interpretations/storage";
import {
  isPolicyInterpretationTopicTag,
  POLICY_INTERPRETATION_TOPIC_TAGS,
} from "@/lib/policy-interpretations/taxonomy";
import { POLICY_REGION_BLOCS } from "@/lib/regions/policy-blocs";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_BLOCS = new Set(
  POLICY_REGION_BLOCS.map((bloc) => bloc.key),
);

function parseTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  let values: string[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      values = parsed.map(String);
    }
  } catch {
    values = raw.split(/[,，]/).map((item) => item.trim());
  }
  const unique = [...new Set(values.filter(Boolean))];
  for (const tag of unique) {
    if (!isPolicyInterpretationTopicTag(tag)) {
      throw Object.assign(
        new Error(
          `未知专题标签：${tag}。可选：${POLICY_INTERPRETATION_TOPIC_TAGS.map((t) => t.key).join(", ")}`,
        ),
        { status: 400, code: "INVALID_TOPIC_TAG" },
      );
    }
  }
  return unique;
}

export async function GET() {
  try {
    await requireAdminApi();
    const client = await createServerSupabaseClient();
    const rows = await new PolicyInterpretationRepository(client).listAll();
    return NextResponse.json({ data: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMultipartMutation(request);
    const admin = await requireAdminApi();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw Object.assign(new Error("请选择要上传的解读文件"), {
        status: 400,
        code: "FILE_REQUIRED",
      });
    }

    const title = String(form.get("title") ?? "").trim();
    if (!title) {
      throw Object.assign(new Error("标题不能为空"), {
        status: 400,
        code: "TITLE_REQUIRED",
      });
    }

    const summaryRaw = String(form.get("summary") ?? "").trim();
    const departmentRaw = String(form.get("department") ?? "").trim();
    const regionIdRaw = String(form.get("region_id") ?? "").trim();
    const regionBloc = String(form.get("region_bloc") ?? "").trim();
    if (!ALLOWED_BLOCS.has(regionBloc as (typeof POLICY_REGION_BLOCS)[number]["key"])) {
      throw Object.assign(new Error("地域标签无效"), {
        status: 400,
        code: "INVALID_REGION_BLOC",
      });
    }

    const publishNow = String(form.get("publish") ?? "") === "1";
    const topicTags = parseTags(form.get("topic_tags"));
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = assertPolicyBriefUpload({
      filename: file.name,
      size: bytes.byteLength,
    });

    const client = await createServerSupabaseClient();
    const repository = new PolicyInterpretationRepository(client);
    const store = new SupabasePolicyBriefBlobStore(client);
    const id = randomUUID();
    const storagePath = policyBriefObjectPath({
      adminId: admin.id,
      briefId: id,
      filename: file.name,
    });

    await store.upload(storagePath, bytes, checked.mimeType);

    const now = new Date().toISOString();
    const row = await repository.insert({
      id,
      title,
      summary: summaryRaw || null,
      region_id: regionIdRaw || null,
      region_bloc: regionBloc,
      topic_tags: topicTags,
      department: departmentRaw || null,
      original_filename: file.name,
      mime_type: checked.mimeType,
      file_ext: checked.extension,
      file_size_bytes: bytes.byteLength,
      storage_path: storagePath,
      is_demo: false,
      is_published: publishNow,
      published_at: publishNow ? now : null,
      created_by: admin.id,
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
