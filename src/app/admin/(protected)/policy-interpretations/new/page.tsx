import Link from "next/link";

import { AdminPolicyInterpretationForm } from "@/components/admin/policy-interpretations/AdminPolicyInterpretationForm";
import { requireAdminPage } from "@/lib/auth/admin";
import { SupabaseRegionRepository } from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPolicyInterpretationNewPage() {
  await requireAdminPage();
  const client = await createServerSupabaseClient();
  const regions = await new SupabaseRegionRepository(client).list();

  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">Upload briefing</span>
          <h1>上传政策专题解读</h1>
          <p>支持 Word、PDF、PPT、Excel。请选择地域片区与专题标签，便于前台筛选。</p>
        </div>
        <Link href="/admin/policy-interpretations" className="button">
          返回列表
        </Link>
      </header>
      <section className="admin-panel">
        <AdminPolicyInterpretationForm regions={regions} />
      </section>
    </>
  );
}
