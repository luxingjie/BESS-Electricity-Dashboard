import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { PolicyInterpretationRepository } from "@/lib/policy-interpretations/repository";
import { SupabasePolicyBriefBlobStore } from "@/lib/policy-interpretations/storage";
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

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertTrustedJsonMutation(request);
    await requireAdminApi();
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const client = await createServerSupabaseClient();
    const repository = new PolicyInterpretationRepository(client);
    const existing = await repository.getById(id);
    if (!existing) {
      throw Object.assign(new Error("解读不存在"), {
        status: 404,
        code: "NOT_FOUND",
      });
    }

    const patch: Parameters<PolicyInterpretationRepository["update"]>[1] = {};

    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) {
        throw Object.assign(new Error("标题不能为空"), {
          status: 400,
          code: "TITLE_REQUIRED",
        });
      }
      patch.title = title;
    }
    if ("summary" in body) {
      const summary =
        body.summary == null ? null : String(body.summary).trim() || null;
      patch.summary = summary;
    }
    if ("department" in body) {
      const department =
        body.department == null
          ? null
          : String(body.department).trim() || null;
      patch.department = department;
    }
    if ("region_id" in body) {
      const regionId =
        body.region_id == null || body.region_id === ""
          ? null
          : String(body.region_id);
      patch.region_id = regionId;
    }
    if (typeof body.region_bloc === "string") {
      if (!ALLOWED_BLOCS.has(body.region_bloc as (typeof POLICY_REGION_BLOCS)[number]["key"])) {
        throw Object.assign(new Error("地域标签无效"), {
          status: 400,
          code: "INVALID_REGION_BLOC",
        });
      }
      patch.region_bloc = body.region_bloc;
    }
    if (Array.isArray(body.topic_tags)) {
      const tags = body.topic_tags.map(String);
      for (const tag of tags) {
        if (!isPolicyInterpretationTopicTag(tag)) {
          throw Object.assign(
            new Error(
              `未知专题标签：${tag}。可选：${POLICY_INTERPRETATION_TOPIC_TAGS.map((t) => t.key).join(", ")}`,
            ),
            { status: 400, code: "INVALID_TOPIC_TAG" },
          );
        }
      }
      patch.topic_tags = [...new Set(tags)];
    }
    if (typeof body.is_published === "boolean") {
      patch.is_published = body.is_published;
      patch.published_at = body.is_published
        ? existing.published_at ?? new Date().toISOString()
        : null;
    }

    const row = await repository.update(id, patch);
    return NextResponse.json({ data: row });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdminApi();
    const { id } = await context.params;
    const client = await createServerSupabaseClient();
    const repository = new PolicyInterpretationRepository(client);
    const existing = await repository.getById(id);
    if (!existing) {
      throw Object.assign(new Error("解读不存在"), {
        status: 404,
        code: "NOT_FOUND",
      });
    }

    const store = new SupabasePolicyBriefBlobStore(client);
    try {
      await store.remove(existing.storage_path);
    } catch {
      // Row delete still proceeds if the object is already gone.
    }
    await repository.remove(id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return errorResponse(error);
  }
}
