"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  PROVINCE_TOPIC_FIELD_COVERAGE_LABELS,
  PROVINCE_TOPIC_LEGAL_STATUS_LABELS,
  PROVINCE_TOPIC_OPERATIONAL_STATUS_LABELS,
} from "@/lib/china-market/status";
import {
  CHINA_MARKET_TOPICS,
  type ChinaMarketTopicId,
} from "@/lib/china-market/taxonomy";
import type {
  ProvinceTopicField,
  ProvinceTopicRecordWithFields,
  Region,
} from "@/lib/types";
import {
  PROVINCE_TOPIC_FIELD_COVERAGE_STATUSES,
  PROVINCE_TOPIC_LEGAL_STATUSES,
  PROVINCE_TOPIC_OPERATIONAL_STATUSES,
} from "@/lib/types";

type Props = {
  regions: Region[];
  record?: ProvinceTopicRecordWithFields | null;
};

type ApiResult = {
  data?: ProvinceTopicRecordWithFields;
  error?: {
    message?: string;
    fields?: Record<string, string[]>;
    issues?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    };
  };
};

function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function errorMessage(payload: ApiResult) {
  const fields =
    payload.error?.fields ?? payload.error?.issues?.fieldErrors ?? {};
  const messages = Object.entries(fields).map(
    ([field, entries]) => `${field}: ${entries.join("、")}`,
  );
  if (payload.error?.issues?.formErrors?.length) {
    messages.push(...payload.error.issues.formErrors);
  }
  return messages.length
    ? messages.join("；")
    : payload.error?.message ?? "请求失败，请重试。";
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : Number.NaN;
}

function fieldName(fieldKey: string, name: string) {
  return `field__${fieldKey}__${name}`;
}

function findField(
  record: ProvinceTopicRecordWithFields | null | undefined,
  fieldKey: string,
): ProvinceTopicField | undefined {
  return record?.fields.find((field) => field.field_key === fieldKey);
}

export function AdminProvinceTopicForm({ regions, record }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [topicId, setTopicId] = useState<ChinaMarketTopicId>(
    record?.topic_id ?? CHINA_MARKET_TOPICS[0].id,
  );
  const [reviewerNote, setReviewerNote] = useState(
    record?.reviewer_note ?? "",
  );

  const provinces = useMemo(() => {
    const china = regions.find(
      (region) =>
        region.region_type === "country" &&
        (region.code === "CN" || region.slug === "china"),
    );
    return china
      ? regions
          .filter(
            (region) =>
              region.region_type === "province" &&
              region.parent_id === china.id,
          )
          .sort((left, right) =>
            left.name_zh.localeCompare(right.name_zh, "zh-CN"),
          )
      : [];
  }, [regions]);

  const topic =
    CHINA_MARKET_TOPICS.find((item) => item.id === topicId) ??
    CHINA_MARKET_TOPICS[0];

  async function saveDraft(
    form: HTMLFormElement,
  ): Promise<ProvinceTopicRecordWithFields | null> {
    const data = new FormData(form);
    const fields = topic.fields.map((definition) => ({
      field_key: definition.key,
      value_text: String(
        data.get(fieldName(definition.key, "value_text")) ?? "",
      ),
      value_numeric: numberOrNull(
        data.get(fieldName(definition.key, "value_numeric")),
      ),
      unit: String(data.get(fieldName(definition.key, "unit")) ?? ""),
      coverage_status: String(
        data.get(fieldName(definition.key, "coverage_status")) ??
          "not_covered",
      ),
      applicability: String(
        data.get(fieldName(definition.key, "applicability")) ?? "",
      ),
      source_url: String(
        data.get(fieldName(definition.key, "source_url")) ?? "",
      ),
      source_name: String(
        data.get(fieldName(definition.key, "source_name")) ?? "",
      ),
      source_locator: String(
        data.get(fieldName(definition.key, "source_locator")) ?? "",
      ),
      evidence_excerpt: String(
        data.get(fieldName(definition.key, "evidence_excerpt")) ?? "",
      ),
    }));
    const payload = {
      region_id: String(data.get("region_id") ?? ""),
      topic_id: topicId,
      title: String(data.get("title") ?? ""),
      summary: String(data.get("summary") ?? ""),
      legal_status: String(data.get("legal_status") ?? "") || null,
      operational_status:
        String(data.get("operational_status") ?? "") || null,
      valid_from: String(data.get("valid_from") ?? ""),
      valid_to: String(data.get("valid_to") ?? ""),
      as_of_date: String(data.get("as_of_date") ?? ""),
      source_url: String(data.get("source_url") ?? ""),
      source_name: String(data.get("source_name") ?? ""),
      source_published_at: String(data.get("source_published_at") ?? ""),
      reviewer_note: String(data.get("reviewer_note") ?? ""),
      is_demo: data.get("is_demo") === "on",
      fields,
    };

    const response = await fetch(
      record
        ? `/api/admin/province-topics/${record.id}`
        : "/api/admin/province-topics",
      {
        method: record ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = (await response.json()) as ApiResult;
    if (!response.ok || !result.data) {
      throw new Error(errorMessage(result));
    }
    return result.data;
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const saved = await saveDraft(event.currentTarget);
      setFeedback({
        kind: "success",
        text: "专题草稿已保存，尚未对外发布。",
      });
      if (!record && saved) {
        router.push(`/admin/province-topics/${saved.id}`);
      }
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: "publish" | "reject") {
    const form = document.getElementById(
      "province-topic-form",
    ) as HTMLFormElement | null;
    if (!form || !record) return;

    setBusy(true);
    setFeedback(null);
    try {
      await saveDraft(form);
      const response = await fetch(
        `/api/admin/province-topics/${record.id}/${action}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewer_note: reviewerNote }),
        },
      );
      const result = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(errorMessage(result));
      setFeedback({
        kind: "success",
        text:
          action === "publish"
            ? "专题记录已发布，中国省级专题页现在可以读取这些字段。"
            : "专题记录已驳回，不会出现在公开页。",
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "状态更新失败",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      id="province-topic-form"
      className="admin-form province-topic-form"
      onSubmit={handleSave}
    >
      <section className="admin-form-section">
        <div className="admin-form-section-heading">
          <span>01 / RECORD</span>
          <div>
            <h2>专题记录</h2>
            <p>一条记录对应一个省份、一个专题和一组共同来源/有效期。</p>
          </div>
        </div>
        <div className="admin-form-grid">
          <label>
            <span>中国省级地区 *</span>
            <select
              name="region_id"
              defaultValue={record?.region_id ?? ""}
              required
            >
              <option value="">请选择省份</option>
              {provinces.map((province) => (
                <option value={province.id} key={province.id}>
                  {province.name_zh} · {province.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>八大专题 *</span>
            <select
              name="topic_id"
              value={topicId}
              disabled={Boolean(record)}
              onChange={(event) =>
                setTopicId(event.target.value as ChinaMarketTopicId)
              }
            >
              {CHINA_MARKET_TOPICS.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.index} · {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            <span>记录标题 *</span>
            <input
              name="title"
              defaultValue={record?.title ?? ""}
              placeholder="例：山东省现货市场交易规则（2026 核验版）"
            />
          </label>
          <label className="span-2">
            <span>摘要</span>
            <textarea
              name="summary"
              rows={4}
              defaultValue={record?.summary ?? ""}
              placeholder="说明适用范围、重要口径和不能据此推断的事项"
            />
          </label>
          <label>
            <span>法律 / 文件状态 *</span>
            <select
              name="legal_status"
              defaultValue={record?.legal_status ?? ""}
            >
              <option value="">请选择</option>
              {PROVINCE_TOPIC_LEGAL_STATUSES.map((status) => (
                <option value={status} key={status}>
                  {PROVINCE_TOPIC_LEGAL_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>市场运行状态</span>
            <select
              name="operational_status"
              defaultValue={record?.operational_status ?? ""}
            >
              <option value="">不适用 / 未填写</option>
              {PROVINCE_TOPIC_OPERATIONAL_STATUSES.map((status) => (
                <option value={status} key={status}>
                  {PROVINCE_TOPIC_OPERATIONAL_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>有效期开始</span>
            <input
              name="valid_from"
              type="date"
              defaultValue={dateInput(record?.valid_from)}
            />
          </label>
          <label>
            <span>有效期结束</span>
            <input
              name="valid_to"
              type="date"
              defaultValue={dateInput(record?.valid_to)}
            />
          </label>
          <label>
            <span>核验截至日期 *</span>
            <input
              name="as_of_date"
              type="date"
              defaultValue={dateInput(record?.as_of_date)}
            />
          </label>
          <label>
            <span>来源发布日期</span>
            <input
              name="source_published_at"
              type="date"
              defaultValue={dateInput(record?.source_published_at)}
            />
          </label>
          <label className="span-2">
            <span>主来源链接 *</span>
            <input
              name="source_url"
              type="url"
              defaultValue={record?.source_url ?? ""}
              placeholder="https://..."
            />
          </label>
          <label>
            <span>主来源名称 *</span>
            <input
              name="source_name"
              defaultValue={record?.source_name ?? ""}
              placeholder="发文机关 / 价表名称"
            />
          </label>
          <label className="check-row">
            <input
              name="is_demo"
              type="checkbox"
              defaultChecked={record?.is_demo ?? false}
            />
            <span>这是 Demo 记录，不代表真实市场结论</span>
          </label>
        </div>
      </section>

      <section className="admin-form-section">
        <div className="admin-form-section-heading">
          <span>02 / FIELDS</span>
          <div>
            <h2>{topic.title}</h2>
            <p>
              {topic.description}
              每个字段必须选择覆盖状态；字段来源留空时沿用上方主来源。
            </p>
          </div>
        </div>

        <div className="topic-field-stack" key={topic.id}>
          {topic.fields.map((definition, index) => {
            const field = findField(record, definition.key);
            return (
              <fieldset className="topic-field-editor" key={definition.key}>
                <legend>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{definition.label}</strong>
                  <small>{definition.valueKind}</small>
                </legend>
                <p>{definition.description}</p>
                <div className="admin-form-grid">
                  <label>
                    <span>覆盖状态 *</span>
                    <select
                      name={fieldName(
                        definition.key,
                        "coverage_status",
                      )}
                      defaultValue={field?.coverage_status ?? "not_covered"}
                    >
                      {PROVINCE_TOPIC_FIELD_COVERAGE_STATUSES.map(
                        (status) => (
                          <option value={status} key={status}>
                            {PROVINCE_TOPIC_FIELD_COVERAGE_LABELS[status]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    <span>标准化数值（可空）</span>
                    <input
                      name={fieldName(definition.key, "value_numeric")}
                      type="number"
                      step="any"
                      defaultValue={field?.value_numeric ?? ""}
                      placeholder="仅用于未来同口径比较"
                    />
                  </label>
                  <label className="span-2">
                    <span>原始展示值</span>
                    <textarea
                      name={fieldName(definition.key, "value_text")}
                      rows={3}
                      defaultValue={field?.value_text ?? ""}
                      placeholder="按原文保留数值、单位、公式或规则摘要；缺失时留空"
                    />
                  </label>
                  <label>
                    <span>单位（可空）</span>
                    <input
                      name={fieldName(definition.key, "unit")}
                      defaultValue={field?.unit ?? ""}
                      placeholder="例：CNY/kW-month、%"
                    />
                  </label>
                  <label>
                    <span>适用范围</span>
                    <input
                      name={fieldName(definition.key, "applicability")}
                      defaultValue={field?.applicability ?? ""}
                      placeholder="电压等级、项目类型、用户类别等"
                    />
                  </label>
                  <label className="span-2">
                    <span>字段来源链接（可空，默认主来源）</span>
                    <input
                      name={fieldName(definition.key, "source_url")}
                      type="url"
                      defaultValue={field?.source_url ?? ""}
                      placeholder="https://..."
                    />
                  </label>
                  <label>
                    <span>字段来源名称（可空，默认主来源）</span>
                    <input
                      name={fieldName(definition.key, "source_name")}
                      defaultValue={field?.source_name ?? ""}
                    />
                  </label>
                  <label>
                    <span>证据定位 *</span>
                    <input
                      name={fieldName(definition.key, "source_locator")}
                      defaultValue={field?.source_locator ?? ""}
                      placeholder="第 8 页 / 表 2 第 3 行 / 第四条"
                    />
                  </label>
                  <label className="span-2">
                    <span>证据摘录 / 核验备注</span>
                    <textarea
                      name={fieldName(definition.key, "evidence_excerpt")}
                      rows={3}
                      defaultValue={field?.evidence_excerpt ?? ""}
                      placeholder="短摘录或说明如何从原文确认该字段；不要粘贴整篇文件"
                    />
                  </label>
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      <section className="admin-form-section">
        <div className="admin-form-section-heading">
          <span>03 / REVIEW</span>
          <div>
            <h2>人工审核</h2>
            <p>
              说明核验了哪些文件、哪些字段仍缺失，以及法律状态与运行状态为何这样判断。
            </p>
          </div>
        </div>
        <div className="admin-form-grid">
          <label className="span-2">
            <span>人工审核说明 *</span>
            <textarea
              name="reviewer_note"
              rows={5}
              value={reviewerNote}
              onChange={(event) => setReviewerNote(event.target.value)}
              placeholder="发布或驳回时必填"
            />
          </label>
        </div>
      </section>

      {feedback ? (
        <div
          className={`form-alert ${
            feedback.kind === "error" ? "is-error" : "is-success"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="button" disabled={busy}>
          {busy ? "处理中…" : "保存草稿"}
        </button>
        {record ? (
          <>
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => transition("publish")}
            >
              发布到专题前端
            </button>
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={() => transition("reject")}
            >
              驳回
            </button>
          </>
        ) : null}
      </div>
    </form>
  );
}
