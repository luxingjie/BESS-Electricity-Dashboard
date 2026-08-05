import type { Region, Signal } from "@/lib/types";
import Link from "next/link";

import { isHighImpactPolicy } from "@/lib/export/policy-signals";
import {
  formatDate,
  formatOptionalText,
  normalizedStatusLabel,
} from "./formatters";
import { HighImpactMark, stripLegacyImpactPrefix } from "./HighImpactMark";
import { isPublishedSignal, StatusPill } from "./Dashboard";

type DemoAware = { is_demo?: boolean };

const REVIEW_STATUS_LABELS: Record<string, string> = {
  ai_draft: "AI 草稿",
  pending_review: "待人工审核",
  published: "已发布",
  rejected: "已驳回",
};

const POLICY_TRACK_LABELS: Record<string, string> = {
  storage_power_market: "储能与电力市场",
  esg: "ESG",
  both: "储能与电力市场 + ESG",
  none: "未归轨",
};

function importanceLabel(signal: Signal): string {
  if (isHighImpactPolicy(signal)) return "Key";
  if (signal.impact_level?.trim()) {
    const level = signal.impact_level.trim().toLowerCase();
    if (level === "high") return "高";
    if (level === "medium") return "中";
    if (level === "low") return "低";
    return signal.impact_level;
  }
  if (typeof signal.ai_importance === "number") {
    return signal.ai_importance.toFixed(2);
  }
  return "—";
}

function policyTrackLabel(signal: Signal): string {
  const track = signal.policy_track?.trim();
  if (!track) return "";
  return POLICY_TRACK_LABELS[track] ?? track;
}

export interface SignalDetailProps {
  signal: Signal;
  region?: Region | null;
  backHref?: string;
  regionHref?: string;
}

export function SignalDetail({
  signal,
  region,
  backHref = "/",
  regionHref,
}: SignalDetailProps) {
  if (!isPublishedSignal(signal)) {
    return null;
  }

  const isDemo = Boolean((signal as Signal & DemoAware).is_demo);
  const regionName =
    region?.name_zh || region?.name_en || region?.code || "未指定地区";
  const category = signal.category?.trim();
  const trackLabel = policyTrackLabel(signal);
  const issuer = signal.issuer?.trim() || "";
  const sourceName = signal.source_name?.trim() || "";
  const sourceLabel = issuer || sourceName || "查看来源";
  const summary = signal.summary?.trim() || "";
  const body = signal.body?.trim() || "";
  const mainContent = body || summary;
  const showSummarySeparately = Boolean(summary && body && summary !== body);
  const reviewNote = signal.reviewer_note?.trim() || "";
  const documentId = signal.document_id?.trim() || "";
  const needsReview = Boolean(signal.needs_human_review);
  const reviewStatusLabel =
    REVIEW_STATUS_LABELS[signal.review_status] ?? signal.review_status;
  const displayTitle = stripLegacyImpactPrefix(signal.title);
  const highImpact = isHighImpactPolicy(signal);

  return (
    <main className="gl-detail-page">
      {isDemo ? (
        <div className="gl-demo-ribbon gl-demo-ribbon-static" role="note">
          <span>演示数据</span> 此记录为演示内容，不代表真实政策或市场结论
        </div>
      ) : null}

      <header className="gl-detail-topbar">
        <Link className="gl-detail-brand" href="/" aria-label="Jinko ESS 首页">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="gl-brand-logo"
            src="/jinko-ess-logo.png"
            alt="Jinko ESS"
            width={120}
            height={73}
          />
          <strong>Grid Ledger</strong>
        </Link>
        <a className="gl-back-link" href={backHref}>
          ← 返回看板
        </a>
      </header>

      <article className="gl-dossier">
        <header className="gl-dossier-header">
          <div className="gl-eyebrow">政策详情</div>
          <div className="gl-detail-region">
            {regionHref ? <a href={regionHref}>{regionName}</a> : regionName}
            {category ? (
              <>
                <span>·</span>
                <span>{category}</span>
              </>
            ) : null}
            {trackLabel ? (
              <>
                <span>·</span>
                <span>{trackLabel}</span>
              </>
            ) : null}
            {isDemo ? <span className="gl-demo-pill">Demo</span> : null}
          </div>
          <h1>
            {highImpact ? (
              <>
                <HighImpactMark className="gl-high-impact-badge" withLabel />{" "}
              </>
            ) : null}
            {displayTitle}
          </h1>
          <StatusPill status={signal.normalized_status} />
        </header>

        <section className="gl-drawer-grid gl-drawer-grid-compact" aria-label="政策要点">
          <div className="gl-drawer-stat">
            <span>状态</span>
            <strong>{normalizedStatusLabel(signal.normalized_status)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>事件日期</span>
            <strong>{formatDate(signal.event_date)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>生效日期</span>
            <strong>{formatDate(signal.effective_date)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>失效日期</span>
            <strong>{formatDate(signal.expires_at)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>发布机构</span>
            <strong>{formatOptionalText(issuer || sourceName)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>文号</span>
            <strong>{formatOptionalText(documentId)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>政策类型</span>
            <strong>{formatOptionalText(category)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>政策轨道</span>
            <strong>{formatOptionalText(trackLabel)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>重要性</span>
            <strong>
              {highImpact ? (
                <HighImpactMark className="gl-high-impact-badge" withLabel />
              ) : (
                importanceLabel(signal)
              )}
            </strong>
          </div>
          <div className="gl-drawer-stat">
            <span>适用地区</span>
            <strong>{regionName}</strong>
          </div>
        </section>

        {showSummarySeparately ? (
          <section className="gl-drawer-section">
            <h2>摘要</h2>
            <p className="gl-dossier-summary">{summary}</p>
          </section>
        ) : null}

        <section className="gl-drawer-section">
          <h2>政策主要内容</h2>
          <p className="gl-dossier-body">
            {mainContent || "暂无主要内容。"}
          </p>
        </section>

        <section className="gl-drawer-section">
          <h2>人工核验</h2>
          {reviewNote ? (
            <p className="gl-dossier-body">{reviewNote}</p>
          ) : (
            <p className="gl-dossier-body gl-dossier-body-muted">暂无核验备注。</p>
          )}
          <dl className="gl-review-meta">
            <div>
              <dt>是否需人工审核</dt>
              <dd>{needsReview ? "是" : "否"}</dd>
            </div>
            <div>
              <dt>审核状态</dt>
              <dd>{reviewStatusLabel}</dd>
            </div>
            <div>
              <dt>发布时间</dt>
              <dd>{formatDate(signal.published_at)}</dd>
            </div>
            <div>
              <dt>审核时间</dt>
              <dd>{formatDate(signal.reviewed_at)}</dd>
            </div>
            <div>
              <dt>抓取时间</dt>
              <dd>{formatDate(signal.crawled_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="gl-drawer-section">
          <h2>原文来源</h2>
          <a
            className="gl-source-card"
            href={signal.source_url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              <strong>{formatOptionalText(sourceLabel)}</strong>
              <small>
                {issuer && sourceName && issuer !== sourceName
                  ? `来源站点：${sourceName}`
                  : "打开官方原文"}
              </small>
            </span>
            <em>查看来源 ↗</em>
          </a>
        </section>
      </article>
    </main>
  );
}
