import { AdminCfdAuctionForm } from "@/components/admin/admin-cfd-auction-form";
import { getAdminCfdAuctionData } from "@/lib/data/admin";

export default async function NewCfdAuctionPage() {
  const { regions } = await getAdminCfdAuctionData();
  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">CfD auctions</span>
          <h1>新增竞价记录</h1>
          <p>没有数据时保持数值为空；不要填 0 代替缺失。</p>
        </div>
      </header>
      <AdminCfdAuctionForm regions={regions} />
    </>
  );
}
