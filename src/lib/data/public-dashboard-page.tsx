import { notFound } from "next/navigation";

import { Dashboard } from "@/components/public";
import { SetupRequired } from "@/components/system/setup-required";
import { getPublicDashboardData } from "@/lib/data/public";
import type { DashboardModule } from "@/lib/regions/dashboard-modules";
import { isChinaRegionScope } from "@/lib/regions/dashboard-modules";

export async function renderPublicDashboardPage(options: {
  /** Content module shown under the shared hero. Home defaults to policy. */
  module: DashboardModule;
  regionSlug?: string;
  searchQuery?: string;
}) {
  const data = await getPublicDashboardData();
  if (!data.configured) return <SetupRequired />;

  const globalRegion = data.regions.find(
    (region) => region.region_type === "global",
  );
  const activeRegion = options.regionSlug
    ? data.regions.find((region) => region.slug === options.regionSlug)
    : globalRegion;

  if (options.regionSlug) {
    if (!activeRegion || activeRegion.region_type === "global") notFound();
  }

  if (
    options.module === "topics" &&
    !isChinaRegionScope(data.regions, activeRegion)
  ) {
    notFound();
  }

  return (
    <Dashboard
      regions={data.regions}
      signals={data.signals}
      marketMetrics={data.marketMetrics}
      provinceTopics={data.provinceTopics}
      cfdAuctions={data.cfdAuctions}
      projectEvents={data.projectEvents}
      activeRegion={activeRegion}
      activeModule={options.module}
      searchQuery={options.searchQuery ?? ""}
    />
  );
}
