"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Region, Signal } from "@/lib/types";
import { NORMALIZED_STATUSES, SIGNAL_TYPES } from "@/lib/types";
import { normalizedStatusLabel } from "@/lib/domain/status";

type Props = {
  regions: Region[];
  signal?: Signal | null;
};

type ApiResult = {
  data?: Signal;
  error?: { message?: string; fields?: Record<string, string[]> };
};

function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function errorMessage(payload: ApiResult) {
  const fields = payload.error?.fields;
  if (fields && Object.keys(fields).length) {
    return Object.entries(fields)
      .map(([field, messages]) => `${field}: ${messages.join("、")}`)
      .join("；");
  }
  return payload.error?.message ?? "请求失败，请重试。";
}

export function AdminSignalForm({ regions, signal }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [reviewerNote, setReviewerNote] = useState(signal?.reviewer_note ?? "");

  async function saveDraft(form: HTMLFormElement): Promise<Signal | null> {
    const data = new FormData(form);
    const payload = {
      region_id: String(data.get("region_id") ?? ""),
      signal_type: String(data.get("signal_type") ?? "policy"),
      title: String(data.get("title") ?? ""),
      summary: String(data.get("summary") ?? ""),
      body: String(data.get("body") ?? ""),
      category: String(data.get("category") ?? ""),
      original_status: String(data.get("original_status") ?? ""),
      normalized_status: String(data.get("normalized_status") ?? "") || null,
      event_date: String(data.get("event_date") ?? ""),
      effective_date: String(data.get("effective_date") ?? ""),
      expires_at: String(data.get("expires_at") ?? ""),
      impact_channel: String(data.get("impact_channel") ?? ""),
      impact_direction: String(data.get("impact_direction") ?? ""),
      impact_level: String(data.get("impact_level") ?? ""),
      source_url: String(data.get("source_url") ?? ""),
      source_name: String(data.get("source_name") ?? ""),
      issuer: String(data.get("issuer") ?? ""),
      document_id: String(data.get("document_id") ?? ""),
      reviewer_note: String(data.get("reviewer_note") ?? ""),
      is_demo: data.get("is_demo") === "on",
    };

    const response = await fetch(signal ? `/api/admin/signals/${signal.id}` : "/api/admin/signals", {
      method: signal ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as ApiResult;
    if (!response.ok || !result.data) throw new Error(errorMessage(result));
    return result.data;
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const saved = await saveDraft(event.currentTarget);
      setFeedback({ kind: "success", text: "草稿已保存，尚未对外发布。" });
      if (!signal && saved) router.push(`/admin/signals/${saved.id}`);
      router.refresh();
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "保存失败" });
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: "publish" | "reject") {
    const form = document.getElementById("signal-form") as HTMLFormElement | null;
    if (!form || !signal) return;
    setBusy(true);
    setFeedback(null);
    try {
      await saveDraft(form);
      const response = await fetch(`/api/admin/signals/${signal.id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewer_note: reviewerNote }),
      });
      const result = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(errorMessage(result));
      setFeedback({
        kind: "success",
        text: action === "publish" ? "已发布，公开页面现在可以读取该记录。" : "已驳回，该记录不会出现在公开页面。",
      });
      router.refresh();
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "状态更新失败" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="signal-form" className="admin-form" onSubmit={handleSave}>
      <div className="admin-form-grid">
        <label>
          <span>地区 *</span>
          <select name="region_id" defaultValue={signal?.region_id ?? ""}>
            <option value="">请选择地区</option>
            {regions.map((region) => <option key={region.id} value={region.id}>{region.name_zh} · {region.region_type}</option>)}
          </select>
        </label>
        <label>
          <span>Signal 类型</span>
          <select name="signal_type" defaultValue={signal?.signal_type ?? "policy"}>
            {SIGNAL_TYPES.map((type) => <option value={type} key={type}>{type}</option>)}
          </select>
        </label>
        <label className="span-2">
          <span>标题 *</span>
          <input name="title" defaultValue={signal?.title ?? ""} placeholder="政策或市场动态标题" />
        </label>
        <label className="span-2">
          <span>摘要 *</span>
          <textarea name="summary" rows={3} defaultValue={signal?.summary ?? ""} placeholder="1–3 句短导语" />
        </label>
        <label className="span-2">
          <span>正文 / 主要内容</span>
          <textarea name="body" rows={8} defaultValue={signal?.body ?? ""} placeholder="政策要点、适用范围、关键义务与时间节点" />
        </label>
        <label>
          <span>分类 / 政策类型</span>
          <input name="category" defaultValue={signal?.category ?? ""} placeholder="如：储能与电力市场政策" />
        </label>
        <label>
          <span>文号</span>
          <input name="document_id" defaultValue={signal?.document_id ?? ""} placeholder="如：发改能源〔2026〕1号" />
        </label>
        <label>
          <span>原始状态</span>
          <input name="original_status" defaultValue={signal?.original_status ?? ""} placeholder="保留来源原文状态" />
        </label>
        <label>
          <span>规范状态 *</span>
          <select name="normalized_status" defaultValue={signal?.normalized_status ?? ""}>
            <option value="">请选择</option>
            {NORMALIZED_STATUSES.map((status) => <option value={status} key={status}>{normalizedStatusLabel(status)}</option>)}
          </select>
        </label>
        <label>
          <span>事件日期</span>
          <input name="event_date" type="date" defaultValue={dateInput(signal?.event_date)} />
        </label>
        <label>
          <span>生效日期</span>
          <input name="effective_date" type="date" defaultValue={dateInput(signal?.effective_date)} />
        </label>
        <label>
          <span>失效日期</span>
          <input name="expires_at" type="date" defaultValue={dateInput(signal?.expires_at)} />
        </label>
        <label>
          <span>影响渠道</span>
          <input name="impact_channel" defaultValue={signal?.impact_channel ?? ""} placeholder="收益 / 成本 / 需求 / 进度" />
        </label>
        <label>
          <span>影响方向</span>
          <input name="impact_direction" defaultValue={signal?.impact_direction ?? ""} placeholder="positive / negative / mixed" />
        </label>
        <label>
          <span>影响级别</span>
          <input name="impact_level" defaultValue={signal?.impact_level ?? ""} placeholder="low / medium / high" />
        </label>
        <label className="span-2">
          <span>原文链接 *</span>
          <input name="source_url" type="url" defaultValue={signal?.source_url ?? ""} placeholder="https://..." />
        </label>
        <label>
          <span>来源名称</span>
          <input name="source_name" defaultValue={signal?.source_name ?? ""} placeholder="站点 / 栏目名" />
        </label>
        <label>
          <span>发布机构</span>
          <input name="issuer" defaultValue={signal?.issuer ?? ""} placeholder="发文机关正式名称" />
        </label>
        <label className="span-2">
          <span>人工确认信息 *</span>
          <textarea
            name="reviewer_note"
            rows={4}
            value={reviewerNote}
            onChange={(event) => setReviewerNote(event.target.value)}
            placeholder="说明核验了什么、状态为何如此归一化；发布或驳回时必填"
          />
        </label>
        <label className="check-row span-2">
          <input name="is_demo" type="checkbox" defaultChecked={signal?.is_demo ?? false} />
          <span>这是 Demo 记录（公开页将显著标记，不代表真实市场数据）</span>
        </label>
      </div>

      {feedback ? <div className={`form-alert ${feedback.kind === "error" ? "is-error" : "is-success"}`}>{feedback.text}</div> : null}

      <div className="form-actions">
        <button type="submit" className="button" disabled={busy}>{busy ? "处理中…" : "保存草稿"}</button>
        {signal ? (
          <>
            <button type="button" className="button primary" disabled={busy} onClick={() => transition("publish")}>发布</button>
            <button type="button" className="button danger" disabled={busy} onClick={() => transition("reject")}>驳回</button>
          </>
        ) : null}
      </div>
    </form>
  );
}
