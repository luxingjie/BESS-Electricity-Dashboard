import Link from "next/link";

import { AdminPolicyInterpretationList } from "@/components/admin/policy-interpretations/AdminPolicyInterpretationList";
import { requireAdminPage } from "@/lib/auth/admin";
import { PolicyInterpretationRepository } from "@/lib/policy-interpretations/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPolicyInterpretationsPage() {
  await requireAdminPage();
  const client = await createServerSupabaseClient();
  const items = await new PolicyInterpretationRepository(client).listAll();

  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">Internal briefings</span>
          <h1>重要政策专题解读</h1>
          <p>
            由内部部门上传 Word / PDF / PPT / Excel。上传时可标注地域与专题标签；发布后出现在公开「政策动态」模块下方。
          </p>
        </div>
        <Link
          href="/admin/policy-interpretations/new"
          className="button primary"
        >
          上传解读
        </Link>
      </header>
      <AdminPolicyInterpretationList items={items} />
    </>
  );
}
