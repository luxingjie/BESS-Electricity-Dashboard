import Link from "next/link";

import { CHINA_MARKET_TOPICS } from "@/lib/china-market/taxonomy";
import { getAdminProvinceTopicListData } from "@/lib/data/admin";
import { reviewStatusLabel } from "@/lib/domain/status";

export default async function AdminProvinceTopicsPage() {
  const { provinceTopics, regions } =
    await getAdminProvinceTopicListData();
  const regionNames = new Map(
    regions.map((region) => [region.id, region.name_zh]),
  );
  const topicNames = new Map(
    CHINA_MARKET_TOPICS.map((topic) => [topic.id, topic.title]),
  );

  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">China province topic ledger</span>
          <h1>省级八专题</h1>
          <p>
            这里维护前端中国省份专题矩阵的数据。它与 Signal
            事件流、通用市场指标相互独立，只有人工发布后的专题字段才会进入公开页。
          </p>
        </div>
        <Link href="/admin/province-topics/new" className="button primary">
          新建专题记录
        </Link>
      </header>

      <section className="admin-panel table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>记录</th>
              <th>省份</th>
              <th>专题</th>
              <th>审核状态</th>
              <th>截至日期</th>
              <th>更新时间</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {provinceTopics.map((record) => (
              <tr key={record.id}>
                <td>
                  <strong>{record.title || "未命名专题草稿"}</strong>
                  {record.is_demo ? <small>DEMO</small> : null}
                </td>
                <td>{regionNames.get(record.region_id) ?? "未知地区"}</td>
                <td>{topicNames.get(record.topic_id) ?? record.topic_id}</td>
                <td>{reviewStatusLabel(record.review_status)}</td>
                <td>{record.as_of_date ?? "—"}</td>
                <td>{new Date(record.updated_at).toLocaleString("zh-CN")}</td>
                <td>
                  <Link href={`/admin/province-topics/${record.id}`}>
                    编辑 →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!provinceTopics.length ? (
          <div className="admin-empty">
            暂无专题记录。新建后先保存草稿，再完成字段来源并人工发布。
          </div>
        ) : null}
      </section>
    </>
  );
}
