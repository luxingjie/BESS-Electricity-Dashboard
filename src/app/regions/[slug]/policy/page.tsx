import { renderPublicDashboardPage } from "@/lib/data/public-dashboard-page";

export const dynamic = "force-dynamic";

export default async function RegionPolicyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ slug }, { q = "" }] = await Promise.all([params, searchParams]);
  return renderPublicDashboardPage({
    module: "policy",
    regionSlug: slug,
    searchQuery: q,
  });
}
