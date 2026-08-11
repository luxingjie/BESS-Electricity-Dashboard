"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { policyInterpretationTopicLabel } from "@/lib/policy-interpretations/taxonomy";
import type { PolicyInterpretation } from "@/lib/policy-interpretations/types";
import { POLICY_REGION_BLOCS } from "@/lib/regions/policy-blocs";

function blocLabel(key: string) {
  return POLICY_REGION_BLOCS.find((bloc) => bloc.key === key)?.label ?? "全球";
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminPolicyInterpretationList({
  items,
}: {
  items: readonly PolicyInterpretation[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/policy-interpretations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "操作失败");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("确认删除该解读及文件？此操作不可恢复。")) return;
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/policy-interpretations/${id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "删除失败");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setBusyId(null);
    }
  }

  if (!items.length) {
    return (
      <section className="admin-panel">
        <p>暂无解读文件。请先上传 Word / PDF / PPT / Excel。</p>
        <Link href="/admin/policy-interpretations/new" className="button primary">
          上传解读
        </Link>
      </section>
    );
  }

  return (
    <section className="admin-panel">
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>地域</th>
              <th>专题</th>
              <th>文件</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.title}</strong>
                  {item.department ? (
                    <div className="admin-muted">{item.department}</div>
                  ) : null}
                </td>
                <td>{blocLabel(item.region_bloc)}</td>
                <td>
                  {item.topic_tags.length
                    ? item.topic_tags
                        .map((tag) => policyInterpretationTopicLabel(tag))
                        .join("、")
                    : "—"}
                </td>
                <td>
                  {item.file_ext.toUpperCase()} ·{" "}
                  {formatBytes(item.file_size_bytes)}
                </td>
                <td>{item.is_published ? "已发布" : "草稿"}</td>
                <td>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="text-button"
                      disabled={busyId === item.id}
                      onClick={() =>
                        patch(item.id, { is_published: !item.is_published })
                      }
                    >
                      {item.is_published ? "下架" : "发布"}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busyId === item.id}
                      onClick={() => remove(item.id)}
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
