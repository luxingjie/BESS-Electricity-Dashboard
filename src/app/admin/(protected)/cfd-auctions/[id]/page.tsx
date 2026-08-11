import { notFound } from "next/navigation";

import { AdminCfdAuctionForm } from "@/components/admin/admin-cfd-auction-form";
import { getAdminCfdAuctionData } from "@/lib/data/admin";

export default async function EditCfdAuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { regions, auction } = await getAdminCfdAuctionData(id);
  if (!auction) notFound();
  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">CfD auctions</span>
          <h1>编辑竞价记录</h1>
          <p>{auction.province_label} · {auction.auction_round ?? "—"} · 交付 {auction.delivery_year ?? "—"}</p>
        </div>
      </header>
      <AdminCfdAuctionForm regions={regions} auction={auction} />
    </>
  );
}
