import { AdminProvinceTopicForm } from "@/components/admin/admin-province-topic-form";
import { getAdminProvinceTopicData } from "@/lib/data/admin";

export default async function NewProvinceTopicPage() {
  const { regions } = await getAdminProvinceTopicData();
  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">Province topic intake</span>
          <h1>新建专题记录</h1>
          <p>
            先选择省份和八大专题之一，再逐字段填写值或明确缺失状态。数值
            0 只表示原文明确为零；没有数据请使用覆盖状态，不要填 0。
          </p>
        </div>
      </header>
      <AdminProvinceTopicForm regions={regions} />
    </>
  );
}
