import Link from "next/link";

import { getAdminCfdAuctionListData } from "@/lib/data/admin";

function fmt(value: number | null) {
  return value == null ? "—" : String(value);
}

export default async function AdminCfdAuctionsPage() {
  const { auctions } = await getAdminCfdAuctionListData();
  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">CfD auctions</span>
          <h1>风光机制电价竞价</h1>
          <p>136号文省级机制电价竞价总表数据。空值表示未公布，不要填 0 代替缺失。</p>
        </div>
        <Link href="/admin/cfd-auctions/new" className="button primary">新增竞价记录</Link>
      </header>
      <section className="admin-panel table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>省份/电网</th>
              <th>轮次</th>
              <th>公告日期</th>
              <th>交付年</th>
              <th>状态</th>
              <th>风电出清</th>
              <th>光伏出清</th>
              <th>中标电量 GWh</th>
              <th>公开</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {auctions.map((auction) => (
              <tr key={auction.id}>
                <td><strong>{auction.province_label}</strong><small>{auction.grid_region ?? ""}</small></td>
                <td>{auction.auction_round ?? "—"}</td>
                <td>{auction.announcement_date ?? "—"}</td>
                <td>{auction.delivery_year ?? "—"}</td>
                <td>{auction.status ?? "—"}</td>
                <td>{fmt(auction.onshore_wind_strike)}</td>
                <td>{fmt(auction.solar_strike)}</td>
                <td>{fmt(auction.awarded_volume_gwh)}</td>
                <td>{auction.is_published ? "是" : "否"}</td>
                <td><Link href={`/admin/cfd-auctions/${auction.id}`}>编辑 →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!auctions.length ? <div className="admin-empty">暂无竞价记录。</div> : null}
      </section>
    </>
  );
}
