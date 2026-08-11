"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { POLICY_INTERPRETATION_TOPIC_TAGS } from "@/lib/policy-interpretations/taxonomy";
import { POLICY_REGION_BLOCS } from "@/lib/regions/policy-blocs";
import type { Region } from "@/lib/types";

type ApiPayload = {
  data?: unknown;
  error?: { message?: string };
};

function fileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminPolicyInterpretationForm({
  regions,
}: {
  regions: readonly Region[];
}) {
  const router = useRouter();
  const fileInputId = useId();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [department, setDepartment] = useState("");
  const [regionBloc, setRegionBloc] = useState("");
  const [regionId, setRegionId] = useState("");
  const [topicTags, setTopicTags] = useState<string[]>([]);
  const [publish, setPublish] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countries = useMemo(
    () =>
      regions
        .filter((region) => region.region_type === "country")
        .slice()
        .sort((a, b) =>
          (a.name_zh || a.name_en || "").localeCompare(
            b.name_zh || b.name_en || "",
            "zh-CN",
          ),
        ),
    [regions],
  );

  const chinaProvinces = useMemo(() => {
    const china = regions.find(
      (region) =>
        region.region_type === "country" && region.slug === "china",
    );
    if (!china) return [];
    return regions
      .filter(
        (region) =>
          region.region_type === "province" && region.parent_id === china.id,
      )
      .slice()
      .sort((a, b) =>
        (a.name_zh || a.name_en || "").localeCompare(
          b.name_zh || b.name_en || "",
          "zh-CN",
        ),
      );
  }, [regions]);

  const isChinaBloc = regionBloc === "bloc:china";

  function toggleTag(key: string) {
    setTopicTags((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("请选择解读文件");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("title", title);
      form.set("summary", summary);
      form.set("department", department);
      form.set("region_bloc", regionBloc);
      form.set("region_id", regionId);
      form.set("topic_tags", JSON.stringify(topicTags));
      form.set("publish", publish ? "1" : "0");
      form.set("file", file);

      const response = await fetch("/api/admin/policy-interpretations", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "上传失败");
      }
      router.push("/admin/policy-interpretations");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <label>
        <span>标题</span>
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例如：2026 容量电价机制解读"
        />
      </label>

      <label>
        <span>摘要</span>
        <textarea
          rows={3}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="一句话说明解读要点（可选）"
        />
      </label>

      <label>
        <span>提供部门</span>
        <input
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          placeholder="例如：政策研究部"
        />
      </label>

      <div className="admin-form-grid">
        <label>
          <span>地域片区</span>
          <select
            value={regionBloc}
            onChange={(event) => {
              setRegionBloc(event.target.value);
              setRegionId("");
            }}
          >
            {POLICY_REGION_BLOCS.map((bloc) => (
              <option key={bloc.key || "global"} value={bloc.key}>
                {bloc.label}
              </option>
            ))}
          </select>
        </label>

        {isChinaBloc ? (
          <label>
            <span>省份（可选）</span>
            <select
              value={regionId}
              onChange={(event) => setRegionId(event.target.value)}
            >
              <option value="">全国 / 不指定省份</option>
              {chinaProvinces.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name_zh || region.name_en || region.code}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span>国家细筛（可选）</span>
            <select
              value={regionId}
              onChange={(event) => setRegionId(event.target.value)}
            >
              <option value="">不指定国家</option>
              {countries.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name_zh || region.name_en || region.code}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <fieldset>
        <legend>专题标签</legend>
        <div className="admin-chip-row">
          {POLICY_INTERPRETATION_TOPIC_TAGS.map((tag) => {
            const active = topicTags.includes(tag.key);
            return (
              <button
                key={tag.key}
                type="button"
                className={active ? "chip is-active" : "chip"}
                onClick={() => toggleTag(tag.key)}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label htmlFor={fileInputId}>
        <span>解读文件（Word / PDF / PPT / Excel，≤ 20 MB）</span>
        <input
          id={fileInputId}
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {file ? (
        <p className="admin-help">
          已选：{file.name} · {fileSize(file.size)}
        </p>
      ) : null}

      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={publish}
          onChange={(event) => setPublish(event.target.checked)}
        />
        <span>上传后立即发布到公开「重要政策专题解读」</span>
      </label>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-form-actions">
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? "上传中…" : "上传解读"}
        </button>
      </div>
    </form>
  );
}
