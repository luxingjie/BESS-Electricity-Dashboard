"use client";

import { useEffect, useMemo, useState } from "react";

import {
  policyInterpretationTopicLabel,
  POLICY_INTERPRETATION_TOPIC_TAGS,
} from "@/lib/policy-interpretations/taxonomy";
import type { PolicyInterpretationPublic } from "@/lib/policy-interpretations/types";
import { POLICY_REGION_BLOCS } from "@/lib/regions/policy-blocs";
import type { Region } from "@/lib/types";

import styles from "./PolicyInterpretationsPanel.module.css";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function regionLabel(region: Region | undefined): string {
  return region?.name_zh || region?.name_en || region?.code || "未命名地区";
}

function blocLabel(key: string) {
  return POLICY_REGION_BLOCS.find((bloc) => bloc.key === key)?.label ?? "全球";
}

function fileKind(ext: string) {
  const normalized = ext.replace(/^\./, "").toUpperCase();
  if (normalized === "PDF") return "PDF";
  if (["DOC", "DOCX"].includes(normalized)) return "Word";
  if (["PPT", "PPTX"].includes(normalized)) return "PPT";
  if (["XLS", "XLSX", "CSV"].includes(normalized)) return "Excel";
  return normalized || "文件";
}

function canInlinePreview(item: PolicyInterpretationPublic) {
  return item.mime_type === "application/pdf" || item.file_ext === ".pdf";
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PolicyInterpretationsPanel({
  regions,
}: {
  regions: readonly Region[];
}) {
  const [items, setItems] = useState<PolicyInterpretationPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regionBloc, setRegionBloc] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [topicTag, setTopicTag] = useState("");
  const [fromDate, setFromDate] = useState(() => daysAgoIso(365));
  const [toDate, setToDate] = useState(todayIso);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

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
        regionLabel(a).localeCompare(regionLabel(b), "zh-CN"),
      );
  }, [regions]);

  const showProvinceFilter = regionBloc === "bloc:china";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (regionBloc) params.set("region_bloc", regionBloc);
        if (showProvinceFilter && provinceId) {
          params.set("region_id", provinceId);
        }
        if (topicTag) params.set("topic_tag", topicTag);
        if (fromDate) params.set("date_from", fromDate);
        if (toDate) params.set("date_to", toDate);
        const response = await fetch(
          `/api/public/policy-interpretations?${params.toString()}`,
        );
        const payload = (await response.json()) as {
          data?: PolicyInterpretationPublic[];
          error?: { message?: string };
        };
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "加载失败");
        }
        if (!cancelled) setItems(payload.data ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [regionBloc, provinceId, showProvinceFilter, topicTag, fromDate, toDate]);

  const regionsById = useMemo(
    () => new Map(regions.map((region) => [region.id, region])),
    [regions],
  );

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    if (!needle) return items;
    return items.filter((item) => {
      const provinceName = item.region_id
        ? regionLabel(regionsById.get(item.region_id))
        : "";
      const haystack = [
        item.title,
        item.summary ?? "",
        item.department ?? "",
        item.original_filename,
        provinceName,
        ...item.topic_tags.map((tag) => policyInterpretationTopicLabel(tag)),
      ]
        .join(" ")
        .toLocaleLowerCase("zh-CN");
      return haystack.includes(needle);
    });
  }, [items, query, regionsById]);

  const previewItem = useMemo(
    () => visibleItems.find((item) => item.id === previewId) ?? null,
    [visibleItems, previewId],
  );

  function runSearch() {
    setQuery(queryDraft.trim());
    setPreviewId(null);
  }

  return (
    <section className={styles.panel} aria-labelledby="policy-briefs-title">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Internal policy briefs</span>
          <h3 id="policy-briefs-title">重要政策专题解读</h3>
          <p className={styles.summary}>
            由内部部门提供的解读材料，默认近一年；中国可细分到省级。PDF
            可在线预览与下载，Word / PPT / Excel 可下载。
          </p>
        </div>
        <div className={styles.count}>
          {String(visibleItems.length).padStart(2, "0")} DOCS
        </div>
      </header>

      <div className={styles.filters}>
        <label>
          <span>地域</span>
          <select
            value={regionBloc}
            onChange={(event) => {
              setRegionBloc(event.target.value);
              setProvinceId("");
              setPreviewId(null);
            }}
          >
            {POLICY_REGION_BLOCS.map((bloc) => (
              <option key={bloc.key || "global"} value={bloc.key}>
                {bloc.label}
              </option>
            ))}
          </select>
        </label>
        {showProvinceFilter ? (
          <label>
            <span>省份</span>
            <select
              value={provinceId}
              onChange={(event) => {
                setProvinceId(event.target.value);
                setPreviewId(null);
              }}
            >
              <option value="">全部省份</option>
              {chinaProvinces.map((region) => (
                <option key={region.id} value={region.id}>
                  {regionLabel(region)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          <span>专题</span>
          <select
            value={topicTag}
            onChange={(event) => {
              setTopicTag(event.target.value);
              setPreviewId(null);
            }}
          >
            <option value="">全部专题</option>
            {POLICY_INTERPRETATION_TOPIC_TAGS.map((tag) => (
              <option key={tag.key} value={tag.key}>
                {tag.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>开始日期</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPreviewId(null);
            }}
          />
        </label>
        <label>
          <span>结束日期</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => {
              setToDate(event.target.value);
              setPreviewId(null);
            }}
          />
        </label>
        <label className={styles.search}>
          <span>关键词</span>
          <input
            type="search"
            value={queryDraft}
            placeholder="标题 / 摘要 / 部门 / 省份"
            onChange={(event) => setQueryDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runSearch();
              }
            }}
          />
        </label>
        <div className={styles.searchAction}>
          <span className={styles.searchActionLabel} aria-hidden="true">
            &nbsp;
          </span>
          <button type="button" className={styles.searchButton} onClick={runSearch}>
            搜索
          </button>
        </div>
      </div>

      {loading ? <p className={styles.empty}>加载解读中…</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {!loading && !error && !visibleItems.length ? (
        <p className={styles.empty}>当前筛选下暂无已发布的专题解读。</p>
      ) : null}

      {visibleItems.length ? (
        <ul className={styles.list}>
          {visibleItems.map((item) => {
            const previewHref = `/api/public/policy-interpretations/${item.id}/file?disposition=inline`;
            const downloadHref = `/api/public/policy-interpretations/${item.id}/file?disposition=attachment`;
            const inline = canInlinePreview(item);
            return (
              <li key={item.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <div className={styles.meta}>
                    <span className={styles.kind}>{fileKind(item.file_ext)}</span>
                    <span>
                      {blocLabel(item.region_bloc)}
                      {item.region_id
                        ? ` · ${regionLabel(regionsById.get(item.region_id))}`
                        : ""}
                    </span>
                    <span>{formatDate(item.published_at)}</span>
                    <span>{formatBytes(item.file_size_bytes)}</span>
                  </div>
                  <strong>{item.title}</strong>
                  {item.summary ? <p>{item.summary}</p> : null}
                  <div className={styles.tags}>
                    {item.department ? (
                      <span className={styles.tag}>{item.department}</span>
                    ) : null}
                    {item.topic_tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {policyInterpretationTopicLabel(tag)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={styles.actions}>
                  {inline ? (
                    <button
                      type="button"
                      className={styles.actionPrimary}
                      onClick={() =>
                        setPreviewId((current) =>
                          current === item.id ? null : item.id,
                        )
                      }
                    >
                      {previewId === item.id ? "收起预览" : "在线浏览"}
                    </button>
                  ) : (
                    <a
                      className={styles.actionPrimary}
                      href={previewHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开
                    </a>
                  )}
                  <a className={styles.action} href={downloadHref}>
                    下载
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {previewItem && canInlinePreview(previewItem) ? (
        <div className={styles.preview}>
          <div className={styles.previewHead}>
            <strong>在线预览 · {previewItem.title}</strong>
            <button type="button" onClick={() => setPreviewId(null)}>
              关闭
            </button>
          </div>
          <iframe
            title={`预览 ${previewItem.title}`}
            src={`/api/public/policy-interpretations/${previewItem.id}/file?disposition=inline`}
            className={styles.frame}
          />
        </div>
      ) : null}
    </section>
  );
}
