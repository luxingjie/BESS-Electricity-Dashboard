"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunPolicyIngestButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/policy-ingest/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload?.error?.message ||
            payload?.message ||
            `运行失败（${response.status}）`,
        );
      }
      const run = payload?.data?.run;
      setMessage(
        `完成：草稿 ${run?.drafts_created ?? 0} · 跳过 ${run?.skips_recorded ?? 0} · 候选 ${run?.candidates_seen ?? 0}`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-quick-actions" style={{ alignItems: "center", gap: 12 }}>
      <button
        type="button"
        className="button primary"
        disabled={busy}
        onClick={onClick}
      >
        {busy ? "抓取中…" : "立即跑一轮"}
      </button>
      {message ? <span>{message}</span> : null}
    </div>
  );
}
