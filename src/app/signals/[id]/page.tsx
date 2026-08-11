import { notFound } from "next/navigation";

import { SignalDetail } from "@/components/public";
import { SetupRequired } from "@/components/system/setup-required";
import { getPublishedSignalDetail } from "@/lib/data/public";

export const dynamic = "force-dynamic";

export default async function SignalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { configured, signal, region } = await getPublishedSignalDetail(id);
  if (!configured) return <SetupRequired />;
  if (!signal) notFound();

  return (
    <SignalDetail
      signal={signal}
      region={region}
      backHref={region && region.region_type !== "global" ? `/regions/${region.slug}` : "/"}
      regionHref={region && region.region_type !== "global" ? `/regions/${region.slug}#region-policy` : "/"}
    />
  );
}
