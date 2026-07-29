import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/http/errors";
import { OpenAiPolicyExtractor } from "@/lib/policy-ingest/ai";
import {
  POLICY_INGEST_LOOKBACK_DAYS,
  POLICY_INGEST_WEEKLY_CAP,
} from "@/lib/policy-ingest/config";
import { PolicyIngestRepository } from "@/lib/policy-ingest/repository";
import { PolicyIngestService } from "@/lib/policy-ingest/service";
import {
  SupabaseRegionRepository,
  SupabaseSignalRepository,
} from "@/lib/repositories/supabase";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

class CronAuthError extends Error {
  readonly status = 401;
  readonly code = "CRON_UNAUTHORIZED";

  constructor(message = "Unauthorized cron request") {
    super(message);
    this.name = "CronAuthError";
  }
}

function assertCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new CronAuthError("CRON_SECRET is not configured");
  }
  const header = request.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) {
    throw new CronAuthError();
  }
}

async function runWeeklyIngest() {
  const client = createServiceSupabaseClient();
  const service = new PolicyIngestService(
    new PolicyIngestRepository(client),
    new SupabaseSignalRepository(client),
    new SupabaseRegionRepository(client),
    () => new OpenAiPolicyExtractor(),
  );

  return service.run({
    trigger: "cron",
    actorId: null,
    lookbackDays: POLICY_INGEST_LOOKBACK_DAYS,
    weeklyCap: POLICY_INGEST_WEEKLY_CAP,
  });
}

export async function GET(request: Request) {
  try {
    assertCronAuthorized(request);
    const result = await runWeeklyIngest();
    return NextResponse.json({
      data: {
        run: result.run,
        draft_ids: result.draftIds,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertCronAuthorized(request);
    const result = await runWeeklyIngest();
    return NextResponse.json({
      data: {
        run: result.run,
        draft_ids: result.draftIds,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
