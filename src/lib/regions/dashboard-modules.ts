import type { Region } from "@/lib/types";

export const DASHBOARD_MODULES = [
  "overview",
  "policy",
  "projects",
  "market",
  "topics",
] as const;

export type DashboardModule = (typeof DASHBOARD_MODULES)[number];

export const DASHBOARD_MODULE_META: Record<
  DashboardModule,
  { index: string; label: string; detail: string }
> = {
  overview: {
    index: "01",
    label: "总览",
    detail: "汇总入口",
  },
  policy: {
    index: "02",
    label: "政策动态",
    detail: "正式政策信息流",
  },
  projects: {
    index: "03",
    label: "项目与招标",
    detail: "与政策流拆分",
  },
  market: {
    index: "04",
    label: "市场数据",
    detail: "装机 / 出货等指标",
  },
  topics: {
    index: "05",
    label: "电力市场与储能政策专题",
    detail: "机制电价 / 省级台账",
  },
};

export function regionBasePath(activeRegion?: Region | null): string {
  if (!activeRegion || activeRegion.region_type === "global") return "";
  return `/regions/${activeRegion.slug}`;
}

export function dashboardModuleHref(
  module: DashboardModule,
  activeRegion?: Region | null,
): string {
  const base = regionBasePath(activeRegion);
  if (module === "overview") return base || "/";
  return `${base}/${module}`;
}

/** Resolve content module from a public dashboard pathname (client soft-nav). */
export function dashboardModuleFromPathname(pathname: string): DashboardModule {
  const leaf = pathname.split("/").filter(Boolean).at(-1);
  if (
    leaf === "policy" ||
    leaf === "projects" ||
    leaf === "market" ||
    leaf === "topics"
  ) {
    return leaf;
  }
  // `/` and `/regions/[slug]` render the policy module by default.
  return "policy";
}

export function isChinaRegionScope(
  regions: readonly Region[],
  activeRegion?: Region | null,
): boolean {
  const china = regions.find(
    (region) =>
      region.region_type === "country" &&
      (region.slug === "china" || region.code === "CN"),
  );
  if (!china || !activeRegion) return false;
  return (
    activeRegion.id === china.id || activeRegion.parent_id === china.id
  );
}
