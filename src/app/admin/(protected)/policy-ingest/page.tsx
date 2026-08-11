import Link from "next/link";

import { RunPolicyIngestButton } from "@/components/admin/run-policy-ingest-button";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  POLICY_INGEST_AUTO_PUBLISH_MIN,
  POLICY_INGEST_DAILY_CAP,
  POLICY_INGEST_LOOKBACK_DAYS,
  POLICY_INGEST_MIN_IMPORTANCE,
  POLICY_INGEST_REGION_QUOTAS,
} from "@/lib/policy-ingest/config";
import { PolicyIngestRepository } from "@/lib/policy-ingest/repository";
import { POLICY_SOURCE_FEED_SEEDS } from "@/lib/policy-ingest/whitelist";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadIngestDesk() {
  if (!getSupabaseConfig()) {
    return {
      feeds: POLICY_SOURCE_FEED_SEEDS.map((feed) => ({
        ...feed,
        enabled: true,
        notes: feed.notes ?? null,
        created_at: "",
        updated_at: "",
      })),
      runs: [] as Awaited<ReturnType<PolicyIngestRepository["listRecentRuns"]>>,
      skips: [] as Awaited<ReturnType<PolicyIngestRepository["listSkipsForRun"]>>,
      usingSeedFallback: true,
    };
  }

  try {
    const client = await createServerSupabaseClient();
    const repo = new PolicyIngestRepository(client);
    const feeds = await repo.listEnabledFeeds();
    const runs = await repo.listRecentRuns(12);
    const skips = runs[0] ? await repo.listSkipsForRun(runs[0].id, 40) : [];
    return { feeds, runs, skips, usingSeedFallback: false };
  } catch {
    return {
      feeds: POLICY_SOURCE_FEED_SEEDS.map((feed) => ({
        ...feed,
        enabled: true,
        notes: feed.notes ?? null,
        created_at: "",
        updated_at: "",
      })),
      runs: [],
      skips: [],
      usingSeedFallback: true,
    };
  }
}

export default async function AdminPolicyIngestPage() {
  const { feeds, runs, skips, usingSeedFallback } = await loadIngestDesk();
  const grouped = feeds.reduce<Record<string, number>>((acc, feed) => {
    acc[feed.region_slug] = (acc[feed.region_slug] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">Daily whitelist ingest</span>
          <h1>政策抓取</h1>
        </div>
        <RunPolicyIngestButton />
      </header>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <span className="section-kicker">Operating envelope</span>
            <h2>运行参数</h2>
          </div>
          <Link href="/admin/signals?review_status=ai_draft">查看 AI 草稿队列 →</Link>
        </div>
        <p>
          每日凌晨（UTC 22:00 ≈ 北京时间 06:00）自动抓取白名单源；可手动补跑。
          双轨筛选（储能与电力市场 / ESG），排除招标融资展会与历史回顾。
          AI 提炼中文摘要后：仅当 star_mark 且重要性 ≥{" "}
          {POLICY_INGEST_AUTO_PUBLISH_MIN}{" "}
          的正式政策自动发布（前台 Key 标识同阈值）；
          {POLICY_INGEST_MIN_IMPORTANCE}–{POLICY_INGEST_AUTO_PUBLISH_MIN}{" "}
          或未标星写入草稿。运行前清理过期/重复 `ai_draft`（已发布不硬删）。
        </p>
        <ul>
          <li>回溯窗口：近 {POLICY_INGEST_LOOKBACK_DAYS} 天</li>
          <li>日入审上限：{POLICY_INGEST_DAILY_CAP} 条（全球合计）</li>
          <li>
            自动发布：star_mark && importance ≥ {POLICY_INGEST_AUTO_PUBLISH_MIN}
          </li>
          <li>
            区域软配额：
            {Object.entries(POLICY_INGEST_REGION_QUOTAS)
              .slice(0, 8)
              .map(([slug, quota]) => `${slug}:${quota}`)
              .join(" · ")}
            …
          </li>
          {usingSeedFallback ? (
            <li>当前展示代码内置白名单（数据库未连接或尚未迁移）。</li>
          ) : null}
        </ul>
      </section>

      <section className="admin-panel table-scroll">
        <div className="admin-panel-header">
          <div>
            <span className="section-kicker">Whitelist</span>
            <h2>源白名单（{feeds.length}）</h2>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>区域</th>
              <th>名称</th>
              <th>来源</th>
              <th>优先级</th>
              <th>List URL</th>
            </tr>
          </thead>
          <tbody>
            {feeds.map((feed) => (
              <tr key={feed.id}>
                <td>{feed.region_slug}</td>
                <td>
                  <strong>{feed.name}</strong>
                </td>
                <td>{feed.source_name}</td>
                <td>{feed.priority}</td>
                <td>
                  <a href={feed.list_url} target="_blank" rel="noreferrer">
                    {feed.list_url}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!feeds.length ? <div className="admin-empty">暂无白名单源。</div> : null}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <span className="section-kicker">Coverage</span>
            <h2>按国家分组</h2>
          </div>
        </div>
        <div className="admin-stat-grid">
          {Object.entries(grouped).map(([slug, count]) => (
            <article key={slug}>
              <span>{slug}</span>
              <strong>{count}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel table-scroll">
        <div className="admin-panel-header">
          <div>
            <span className="section-kicker">Runs</span>
            <h2>最近运行</h2>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>开始</th>
              <th>触发</th>
              <th>状态</th>
              <th>自动发布</th>
              <th>草稿</th>
              <th>清理</th>
              <th>跳过</th>
              <th>候选</th>
              <th>源数</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{new Date(run.started_at).toLocaleString("zh-CN")}</td>
                <td>{run.trigger}</td>
                <td>{run.status}</td>
                <td>{run.auto_published ?? 0}</td>
                <td>{run.drafts_retained ?? run.drafts_created}</td>
                <td>{run.drafts_cleaned ?? 0}</td>
                <td>{run.skips_recorded}</td>
                <td>{run.candidates_seen}</td>
                <td>{run.feeds_scanned}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!runs.length ? (
          <div className="admin-empty">尚无运行记录。可点击「立即跑一轮」。</div>
        ) : null}
      </section>

      <section className="admin-panel table-scroll">
        <div className="admin-panel-header">
          <div>
            <span className="section-kicker">Skip log</span>
            <h2>最近一轮跳过</h2>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>原因</th>
              <th>标题</th>
              <th>URL</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {skips.map((skip) => (
              <tr key={skip.id}>
                <td>{skip.reason}</td>
                <td>{skip.title || "—"}</td>
                <td>
                  {skip.source_url ? (
                    <a href={skip.source_url} target="_blank" rel="noreferrer">
                      链接
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{skip.detail || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!skips.length ? (
          <div className="admin-empty">暂无跳过日志。</div>
        ) : null}
      </section>
    </>
  );
}
