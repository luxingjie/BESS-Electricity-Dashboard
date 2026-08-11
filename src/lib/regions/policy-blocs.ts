import { descendantRegionIds } from "@/lib/regions/descendant-ids";
import type { Region } from "@/lib/types";

/**
 * Business desks for public policy / drill-down navigation.
 * Intentionally not UN continent geography (e.g. Mexico → LatAm, AU/NZ → APAC).
 */
export const POLICY_REGION_BLOCS = [
  { key: "", label: "全球" },
  { key: "bloc:china", label: "中国" },
  { key: "bloc:apac", label: "亚太（除中国）" },
  { key: "bloc:europe", label: "欧洲" },
  { key: "bloc:north-america", label: "北美" },
  { key: "bloc:latam", label: "拉美" },
  { key: "bloc:mea", label: "中东非" },
] as const;

export type PolicyRegionBlocKey =
  (typeof POLICY_REGION_BLOCS)[number]["key"];

export const POLICY_DRILLDOWN_BLOCS = POLICY_REGION_BLOCS.filter(
  (bloc) => bloc.key !== "",
);

export const POLICY_BLOC_COUNTRY_SLUGS: Record<
  Exclude<PolicyRegionBlocKey, "">,
  readonly string[]
> = {
  "bloc:china": ["china"],
  "bloc:apac": [
    "india",
    "indonesia",
    "japan",
    "malaysia",
    "singapore",
    "south-korea",
    "australia",
    "new-zealand",
  ],
  "bloc:europe": [
    "united-kingdom",
    "germany",
    "france",
    "italy",
    "spain",
    "netherlands",
  ],
  "bloc:north-america": ["usa", "canada"],
  "bloc:latam": ["mexico", "brazil", "chile", "argentina", "colombia"],
  "bloc:mea": ["egypt", "morocco", "kenya", "south-africa"],
};

const SLUG_TO_BLOC = new Map<string, Exclude<PolicyRegionBlocKey, "">>();
for (const [blocKey, slugs] of Object.entries(POLICY_BLOC_COUNTRY_SLUGS) as Array<
  [Exclude<PolicyRegionBlocKey, "">, readonly string[]]
>) {
  for (const slug of slugs) SLUG_TO_BLOC.set(slug, blocKey);
}

export function policyBlocForCountrySlug(
  slug: string,
): Exclude<PolicyRegionBlocKey, ""> | null {
  return SLUG_TO_BLOC.get(slug) ?? null;
}

export function countriesInPolicyBloc(
  regions: readonly Region[],
  blocKey: Exclude<PolicyRegionBlocKey, "">,
): Region[] {
  const slugs = POLICY_BLOC_COUNTRY_SLUGS[blocKey];
  const bySlug = new Map(
    regions
      .filter((region) => region.region_type === "country")
      .map((region) => [region.slug, region]),
  );
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((region): region is Region => Boolean(region));
}

export function resolvePolicyBlocScopeIds(
  regions: readonly Region[],
  filter: string,
): Set<string> | null {
  if (!filter) return null;

  const blocSlugs =
    POLICY_BLOC_COUNTRY_SLUGS[filter as Exclude<PolicyRegionBlocKey, "">];
  if (blocSlugs) {
    const ids = new Set<string>();
    for (const slug of blocSlugs) {
      const country = regions.find(
        (region) =>
          region.region_type === "country" && region.slug === slug,
      );
      if (!country) continue;
      for (const id of descendantRegionIds(regions, country.id)) {
        ids.add(id);
      }
    }
    return ids;
  }

  return descendantRegionIds(regions, filter);
}
