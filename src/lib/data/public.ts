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
};

export async function getPublicDashboardData(): Promise<PublicDashboardData> {
  if (!getSupabaseConfig()) {
    // Fallback: return mock data when Supabase is not configured
    const { MOCK_DASHBOARD_DATA } = await import("./mock");
    return MOCK_DASHBOARD_DATA;
  }

  try {
    const client = await createServerSupabaseClient();
    const regionRepository = new SupabaseRegionRepository(client);
    const signalService = new SignalService(new SupabaseSignalRepository(client));
    const metricRepository = new SupabaseMarketMetricRepository(client);
    const provinceTopicService = new ProvinceTopicService(
      new SupabaseProvinceTopicRepository(client),
    );

    const cfdAuctionRepository = new SupabaseCfdAuctionRepository(client);

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
    };
  } catch {
    // Fallback: return mock data when Supabase is unreachable
    const { MOCK_DASHBOARD_DATA } = await import("./mock");
    return MOCK_DASHBOARD_DATA;
  }
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
