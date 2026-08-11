import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/http/errors";
import { PolicyInterpretationRepository } from "@/lib/policy-interpretations/repository";
import { isPolicyInterpretationTopicTag } from "@/lib/policy-interpretations/taxonomy";
import { POLICY_REGION_BLOCS } from "@/lib/regions/policy-blocs";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_BLOCS = new Set(
  POLICY_REGION_BLOCS.map((bloc) => bloc.key),
);

export async function GET(request: Request) {
  try {
    if (!getSupabaseConfig()) {
      return NextResponse.json({ data: [] });
    }

    const url = new URL(request.url);
    const regionBloc = url.searchParams.get("region_bloc") ?? undefined;
    const topicTag = url.searchParams.get("topic_tag") ?? undefined;
    const dateFrom = url.searchParams.get("date_from") ?? undefined;
    const dateTo = url.searchParams.get("date_to") ?? undefined;
    const regionId = url.searchParams.get("region_id") ?? undefined;

    if (
      regionBloc &&
      !ALLOWED_BLOCS.has(regionBloc as (typeof POLICY_REGION_BLOCS)[number]["key"])
    ) {
      throw Object.assign(new Error("地域筛选无效"), {
        status: 400,
        code: "INVALID_REGION_BLOC",
      });
    }
    if (topicTag && !isPolicyInterpretationTopicTag(topicTag)) {
      throw Object.assign(new Error("专题筛选无效"), {
        status: 400,
        code: "INVALID_TOPIC_TAG",
      });
    }
    if (regionId && !/^[0-9a-f-]{36}$/i.test(regionId)) {
      throw Object.assign(new Error("省份筛选无效"), {
        status: 400,
        code: "INVALID_REGION_ID",
      });
    }
    if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      throw Object.assign(new Error("开始日期无效"), {
        status: 400,
        code: "INVALID_DATE_FROM",
      });
    }
    if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      throw Object.assign(new Error("结束日期无效"), {
        status: 400,
        code: "INVALID_DATE_TO",
      });
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw Object.assign(new Error("开始日期不能晚于结束日期"), {
        status: 400,
        code: "INVALID_DATE_RANGE",
      });
    }

    const client = await createServerSupabaseClient();
    const rows = await new PolicyInterpretationRepository(client).listPublic({
      regionBloc: regionBloc || undefined,
      topicTag: topicTag || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      regionId: regionId || undefined,
    });
    return NextResponse.json({ data: rows });
  } catch (error) {
    return errorResponse(error);
  }
}
