import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/http/errors";
import { PolicyInterpretationRepository } from "@/lib/policy-interpretations/repository";
import {
  POLICY_BRIEF_STORAGE_BUCKET,
  SupabasePolicyBriefBlobStore,
} from "@/lib/policy-interpretations/storage";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function asciiFilename(name: string): string {
  return name.replace(/[^\x20-\x7E]+/g, "_") || "brief";
}

export async function GET(request: Request, context: RouteContext) {
  try {
    if (!getSupabaseConfig()) {
      throw Object.assign(new Error("存储未配置"), {
        status: 503,
        code: "NOT_CONFIGURED",
      });
    }

    const { id } = await context.params;
    const url = new URL(request.url);
    const disposition =
      url.searchParams.get("disposition") === "attachment"
        ? "attachment"
        : "inline";

    // Metadata via anon/authenticated RLS (published only).
    const publicClient = await createServerSupabaseClient();
    const published = await new PolicyInterpretationRepository(
      publicClient,
    ).getPublicById(id);
    if (!published) {
      throw Object.assign(new Error("解读不存在或未发布"), {
        status: 404,
        code: "NOT_FOUND",
      });
    }

    // Bytes via service role — storage RLS is admin-only.
    const service = createServiceSupabaseClient();
    const bytes = await new SupabasePolicyBriefBlobStore(service).download(
      published.storage_path,
    );

    const headers = new Headers();
    headers.set("Content-Type", published.mime_type || "application/octet-stream");
    headers.set("Content-Length", String(bytes.byteLength));
    headers.set("Cache-Control", "private, max-age=60");
    headers.set(
      "Content-Disposition",
      `${disposition}; filename="${asciiFilename(published.original_filename)}"; filename*=UTF-8''${encodeURIComponent(published.original_filename)}`,
    );
    headers.set("X-Content-Type-Options", "nosniff");
    // Help browsers that sniff Office payloads.
    headers.set("X-Policy-Brief-Bucket", POLICY_BRIEF_STORAGE_BUCKET);

    return new NextResponse(Buffer.from(bytes), { status: 200, headers });
  } catch (error) {
    return errorResponse(error);
  }
}
