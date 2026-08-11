import Link from "next/link";

import { getSupabaseConfig } from "@/lib/supabase/config";

import { loginAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  "not-configured": "请先配置 Supabase 环境变量并初始化数据库。",
  "missing-credentials": "请输入邮箱和密码。",
  "invalid-credentials": "邮箱或密码不正确。",
  "admin-required": "此账号没有管理员权限。",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = Boolean(getSupabaseConfig());

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-lockup">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand-lockup-logo"
            src="/jinko-ess-logo.png"
            alt="Jinko ESS"
            width={168}
            height={102}
          />
          <div>
            <strong>Grid Ledger</strong>
            <span>ADMIN REVIEW DESK</span>
          </div>
        </div>
        <div className="section-kicker">Restricted access</div>
        <h1>管理员登录</h1>
        <p>登录后可录入、审核、发布 Signal，并维护公开市场指标。</p>

        {error ? <div className="form-alert is-error">{ERROR_MESSAGES[error] ?? "登录失败，请重试。"}</div> : null}
        {!configured ? (
          <div className="form-alert">当前尚未配置数据库。复制 `.env.example` 为 `.env.local` 后重启应用。</div>
        ) : null}

        <form action={loginAction} className="stack-form">
          <label>
            <span>管理员邮箱</span>
            <input name="email" type="email" autoComplete="username" required disabled={!configured} />
          </label>
          <label>
            <span>密码</span>
            <input name="password" type="password" autoComplete="current-password" required disabled={!configured} />
          </label>
          <button type="submit" className="button primary" disabled={!configured}>进入审核台</button>
        </form>

        <Link href="/" className="text-link">← 返回公开看板</Link>
      </section>
    </main>
  );
}
