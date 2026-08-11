import { renderPublicDashboardPage } from "@/lib/data/public-dashboard-page";

export const dynamic = "force-dynamic";

export default async function GlobalMarketPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  return renderPublicDashboardPage({
    module: "market",
    searchQuery: q,
  });
}
