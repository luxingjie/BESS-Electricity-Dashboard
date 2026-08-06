import "server-only";

import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  SupabaseCfdAuctionRepository,
  SupabaseMarketMetricRepository,
  SupabaseProvinceTopicRepository,
  SupabaseRegionRepository,
  SupabaseSignalRepository,
} from "@/lib/repositories/supabase";
import { SignalService } from "@/lib/services/signal-service";
import { ProvinceTopicService } from "@/lib/services/province-topic-service";
import type {
  ChinaCfdAuction,
  MarketMetric,
  ProvinceTopicRecordWithFields,
  PublicBessProjectEvent,
  Region,
  Signal,
} from "@/lib/types";

export type PublicDashboardData = {
  configured: boolean;
  regions: Region[];
  signals: Signal[];
  marketMetrics: MarketMetric[];
  provinceTopics: ProvinceTopicRecordWithFields[];
  cfdAuctions: ChinaCfdAuction[];
  projectEvents: PublicBessProjectEvent[];
};

const UNCONFIGURED_DASHBOARD_DATA: PublicDashboardData = {
  configured: false,
  regions: [],
  signals: [],
  marketMetrics: [],
  provinceTopics: [],
  cfdAuctions: [],
  projectEvents: [],
};

export async function getPublicDashboardData(): Promise<PublicDashboardData> {
  if (!getSupabaseConfig()) {
    return UNCONFIGURED_DASHBOARD_DATA;
  }

  const client = await createServerSupabaseClient();
  const regionRepository = new SupabaseRegionRepository(client);
  const signalService = new SignalService(new SupabaseSignalRepository(client));
  const metricRepository = new SupabaseMarketMetricRepository(client);
  const provinceTopicService = new ProvinceTopicService(
    new SupabaseProvinceTopicRepository(client),
  );

  const cfdAuctionRepository = new SupabaseCfdAuctionRepository(client);

  // Project events are fetched on demand via /api/public/project-events
  // (paginated). Do not embed the full table into every dashboard RSC payload.
  const [regions, signals, marketMetrics, provinceTopics, cfdAuctions] =
    await Promise.all([
      regionRepository.list(),
      signalService.listPublic(),
      metricRepository.listPublic(),
      provinceTopicService.listPublic(),
      cfdAuctionRepository.listPublic(),
    ]);

  return {
    configured: true,
    regions,
    signals,
    marketMetrics,
    provinceTopics,
    cfdAuctions,
    projectEvents: [],
  };
}

export async function getPublishedSignalDetail(id: string) {
  if (!getSupabaseConfig()) return { configured: false, signal: null, region: null };

  const client = await createServerSupabaseClient();
  const signalService = new SignalService(new SupabaseSignalRepository(client));
  const regionRepository = new SupabaseRegionRepository(client);
  const signal = await signalService.getPublicById(id);
  const region = signal?.region_id ? await regionRepository.getById(signal.region_id) : null;
  return { configured: true, signal, region };
}
