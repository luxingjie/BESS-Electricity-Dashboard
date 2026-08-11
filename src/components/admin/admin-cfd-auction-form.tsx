"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ChinaCfdAuction, Region } from "@/lib/types";

const NUMERIC_FIELDS = [
  "onshore_wind_floor",
  "onshore_wind_cap",
  "onshore_wind_strike",
  "offshore_wind_floor",
  "offshore_wind_cap",
  "offshore_wind_strike",
  "solar_floor",
  "solar_cap",
  "solar_strike",
  "coal_benchmark",
  "target_volume_gwh",
  "awarded_volume_gwh",
  "subscription_rate",
  "onshore_wind_target_gwh",
  "onshore_wind_awarded_gwh",
  "offshore_wind_target_gwh",
  "offshore_wind_awarded_gwh",
  "solar_target_gwh",
  "solar_awarded_gwh",
  "duration_years_onshore",
  "duration_years_offshore",
  "duration_years_solar",
  "legacy_coverage_ratio",
  "legacy_strike",
  "legacy_duration_years",
] as const;

function numberInput(
  data: FormData,
  key: string,
): number | null {
  const raw = String(data.get(key) ?? "").trim();
  return raw === "" ? null : Number(raw);
}

export function AdminCfdAuctionForm({
  regions,
  auction,
}: {
  regions: Region[];
  auction?: ChinaCfdAuction | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const provinces = regions.filter((region) => region.region_type === "province");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    const data = new FormData(event.currentTarget);
    const rawDeliveryYear = String(data.get("delivery_year") ?? "").trim();
    const payload: Record<string, unknown> = {
      region_id: String(data.get("region_id") ?? ""),
      province_label: String(data.get("province_label") ?? ""),
      province_label_en: String(data.get("province_label_en") ?? ""),
      grid_region: String(data.get("grid_region") ?? ""),
      auction_round: String(data.get("auction_round") ?? ""),
      announcement_date: String(data.get("announcement_date") ?? ""),
      delivery_year: rawDeliveryYear === "" ? null : Number(rawDeliveryYear),
      commissioning_window: String(data.get("commissioning_window") ?? ""),
      status: String(data.get("status") ?? ""),
      pot_design: String(data.get("pot_design") ?? ""),
      note: String(data.get("note") ?? ""),
      source_url: String(data.get("source_url") ?? ""),
      source_name: String(data.get("source_name") ?? ""),
      implementation_plan_url: String(data.get("implementation_plan_url") ?? ""),
      implementation_plan_name: String(data.get("implementation_plan_name") ?? ""),
      announcement_url: String(data.get("announcement_url") ?? ""),
      announcement_name: String(data.get("announcement_name") ?? ""),
      supplemental_url: String(data.get("supplemental_url") ?? ""),
      supplemental_name: String(data.get("supplemental_name") ?? ""),
      legacy_note: String(data.get("legacy_note") ?? ""),
      legacy_url: String(data.get("legacy_url") ?? ""),
      is_demo: data.get("is_demo") === "on",
      is_published: data.get("is_published") === "on",
    };
    for (const key of NUMERIC_FIELDS) payload[key] = numberInput(data, key);

    try {
      const response = await fetch(
        auction ? `/api/admin/cfd-auctions/${auction.id}` : "/api/admin/cfd-auctions",
        {
          method: auction ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as {
        data?: ChinaCfdAuction;
        error?: { message?: string };
      };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? "保存失败");
      if (!auction) router.push(`/admin/cfd-auctions/${result.data.id}`);
      setFeedback("竞价记录已保存。空值在公开总表显示为 —，不会显示为 0。");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  const numberField = (
    name: (typeof NUMERIC_FIELDS)[number],
    label: string,
  ) => (
    <label key={name}>
      <span>{label}</span>
      <input
        name={name}
        type="number"
        step="any"
        defaultValue={auction?.[name] ?? ""}
      />
    </label>
  );

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-grid">
        <label>
          <span>省级地区 *</span>
          <select name="region_id" defaultValue={auction?.region_id ?? ""} required>
            <option value="">请选择</option>
            {provinces.map((region) => (
              <option value={region.id} key={region.id}>{region.name_zh}</option>
            ))}
          </select>
        </label>
        <label>
          <span>展示名称 *（如 冀北 / 蒙西）</span>
          <input name="province_label" defaultValue={auction?.province_label ?? ""} required />
        </label>
        <label>
          <span>英文名称</span>
          <input name="province_label_en" defaultValue={auction?.province_label_en ?? ""} placeholder="North Hebei" />
        </label>
        <label>
          <span>区域电网</span>
          <input name="grid_region" defaultValue={auction?.grid_region ?? ""} placeholder="华北 / 东北 / 西北 / 华中 / 华东 / 南方" />
        </label>
        <label>
          <span>竞价轮次</span>
          <input name="auction_round" defaultValue={auction?.auction_round ?? ""} placeholder="第1轮" />
        </label>
        <label>
          <span>结果公告日期</span>
          <input name="announcement_date" type="date" defaultValue={auction?.announcement_date?.slice(0, 10) ?? ""} />
        </label>
        <label>
          <span>交付年份</span>
          <input name="delivery_year" type="number" step="1" defaultValue={auction?.delivery_year ?? ""} />
        </label>
        <label>
          <span>并网窗口</span>
          <input name="commissioning_window" defaultValue={auction?.commissioning_window ?? ""} />
        </label>
        <label>
          <span>状态</span>
          <input name="status" defaultValue={auction?.status ?? ""} placeholder="已完成 / 未启动" />
        </label>
        <label>
          <span>竞价池设计</span>
          <input name="pot_design" defaultValue={auction?.pot_design ?? ""} />
        </label>
      </div>

      <h3 className="section-kicker admin-form-subhead">价格（元/MWh）</h3>
      <div className="admin-form-grid">
        {numberField("onshore_wind_floor", "陆上风电 下限")}
        {numberField("onshore_wind_cap", "陆上风电 上限")}
        {numberField("onshore_wind_strike", "陆上风电 出清价")}
        {numberField("offshore_wind_floor", "海上风电 下限")}
        {numberField("offshore_wind_cap", "海上风电 上限")}
        {numberField("offshore_wind_strike", "海上风电 出清价")}
        {numberField("solar_floor", "光伏 下限")}
        {numberField("solar_cap", "光伏 上限")}
        {numberField("solar_strike", "光伏 出清价")}
        {numberField("coal_benchmark", "燃煤基准价")}
      </div>

      <h3 className="section-kicker admin-form-subhead">电量（GWh）与认购率（%）</h3>
      <div className="admin-form-grid">
        {numberField("target_volume_gwh", "目标电量（风+光）")}
        {numberField("awarded_volume_gwh", "中标电量（风+光）")}
        {numberField("subscription_rate", "认购率 %")}
        {numberField("onshore_wind_target_gwh", "陆上风电 目标")}
        {numberField("onshore_wind_awarded_gwh", "陆上风电 中标")}
        {numberField("offshore_wind_target_gwh", "海上风电 目标")}
        {numberField("offshore_wind_awarded_gwh", "海上风电 中标")}
        {numberField("solar_target_gwh", "光伏 目标")}
        {numberField("solar_awarded_gwh", "光伏 中标")}
      </div>

      <h3 className="section-kicker admin-form-subhead">执行期限（年）与来源</h3>
      <div className="admin-form-grid">
        {numberField("duration_years_onshore", "陆上风电 期限")}
        {numberField("duration_years_offshore", "海上风电 期限")}
        {numberField("duration_years_solar", "光伏 期限")}
        <label className="span-2">
          <span>竞价结果公告链接</span>
          <input name="source_url" type="url" defaultValue={auction?.source_url ?? ""} />
        </label>
        <label>
          <span>公告来源名称</span>
          <input name="source_name" defaultValue={auction?.source_name ?? ""} placeholder="BloombergNEF / 省发改委" />
        </label>
        <label className="span-2">
          <span>省级承接政策链接（实施方案）</span>
          <input
            name="implementation_plan_url"
            type="url"
            defaultValue={auction?.implementation_plan_url ?? ""}
            placeholder="https://..."
          />
        </label>
        <label>
          <span>承接政策名称</span>
          <input
            name="implementation_plan_name"
            defaultValue={auction?.implementation_plan_name ?? ""}
            placeholder="省级实施方案"
          />
        </label>
        <label className="span-2">
          <span>竞价公告链接</span>
          <input
            name="announcement_url"
            type="url"
            defaultValue={auction?.announcement_url ?? ""}
          />
        </label>
        <label>
          <span>竞价公告名称</span>
          <input
            name="announcement_name"
            defaultValue={auction?.announcement_name ?? ""}
            placeholder="竞价公告"
          />
        </label>
        <label className="span-2">
          <span>补充文件链接</span>
          <input
            name="supplemental_url"
            type="url"
            defaultValue={auction?.supplemental_url ?? ""}
          />
        </label>
        <label>
          <span>补充文件名称</span>
          <input
            name="supplemental_name"
            defaultValue={auction?.supplemental_name ?? ""}
            placeholder="补充文件"
          />
        </label>
        <label className="span-2">
          <span>备注</span>
          <textarea name="note" rows={3} defaultValue={auction?.note ?? ""} />
        </label>
        {numberField("legacy_coverage_ratio", "存量覆盖比例 %")}
        {numberField("legacy_strike", "存量机制电价")}
        {numberField("legacy_duration_years", "存量执行年限")}
        <label className="span-2">
          <span>存量政策链接</span>
          <input
            name="legacy_url"
            type="url"
            defaultValue={auction?.legacy_url ?? ""}
          />
        </label>
        <label className="span-2">
          <span>存量说明</span>
          <textarea
            name="legacy_note"
            rows={2}
            defaultValue={auction?.legacy_note ?? ""}
          />
        </label>
        <label className="check-row">
          <input name="is_demo" type="checkbox" defaultChecked={auction?.is_demo ?? false} />
          <span>Demo</span>
        </label>
        <label className="check-row">
          <input name="is_published" type="checkbox" defaultChecked={auction?.is_published ?? true} />
          <span>公开展示</span>
        </label>
      </div>

      {feedback ? <div className="form-alert">{feedback}</div> : null}
      <div className="form-actions">
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? "保存中…" : "保存竞价记录"}
        </button>
      </div>
    </form>
  );
}
