export type AnalyticsBucket = {
  key: string;
  label: string;
  count: number;
  power_mw: number | null;
  energy_mwh: number | null;
};

export type BessProjectAnalytics = {
  sample_size: number;
  counts?: {
    all: number;
    tender: number;
    award: number;
    commissioning: number;
  };
  by_month: AnalyticsBucket[];
  by_province: AnalyticsBucket[];
  by_scene: AnalyticsBucket[];
  by_duration: AnalyticsBucket[];
  by_scope: AnalyticsBucket[];
  date_min?: string | null;
  date_max?: string | null;
};

/** Pad month buckets so yearly (or fixed) ranges stay comparable. */
export function padMonthBuckets(
  buckets: readonly AnalyticsBucket[],
  dateFrom: string | null | undefined,
  dateTo: string | null | undefined,
): AnalyticsBucket[] {
  if (!dateFrom || !dateTo) return [...buckets];
  const fromMatch = /^(\d{4})-(\d{2})/.exec(dateFrom);
  const toMatch = /^(\d{4})-(\d{2})/.exec(dateTo);
  if (!fromMatch || !toMatch) return [...buckets];

  const keys: string[] = [];
  let year = Number(fromMatch[1]);
  let month = Number(fromMatch[2]);
  const endYear = Number(toMatch[1]);
  const endMonth = Number(toMatch[2]);
  // Cap at 36 months to avoid runaway UI for huge custom ranges.
  for (let i = 0; i < 36; i += 1) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    if (year === endYear && month === endMonth) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  return keys.map(
    (key) =>
      byKey.get(key) ?? {
        key,
        label: key,
        count: 0,
        power_mw: null,
        energy_mwh: null,
      },
  );
}

export type AnalyticsRow = {
  event_date: string | null;
  province_label: string | null;
  scene: string | null;
  duration_band: string | null;
  duration_h: number | null;
  scope_label: string | null;
  power_mw: number | null;
  energy_mwh: number | null;
};

function pushBucket(
  map: Map<string, { label: string; count: number; power: number; energy: number; powerN: number; energyN: number }>,
  key: string,
  label: string,
  row: AnalyticsRow,
) {
  const current = map.get(key) ?? {
    label,
    count: 0,
    power: 0,
    energy: 0,
    powerN: 0,
    energyN: 0,
  };
  current.count += 1;
  if (row.power_mw != null && Number.isFinite(row.power_mw)) {
    current.power += row.power_mw;
    current.powerN += 1;
  }
  if (row.energy_mwh != null && Number.isFinite(row.energy_mwh)) {
    current.energy += row.energy_mwh;
    current.energyN += 1;
  }
  map.set(key, current);
}

function toBuckets(
  map: Map<string, { label: string; count: number; power: number; energy: number; powerN: number; energyN: number }>,
  options?: { sort?: "count" | "key"; limit?: number; includeOther?: boolean },
): AnalyticsBucket[] {
  const sort = options?.sort ?? "count";
  let rows = [...map.entries()].map(([key, value]) => ({
    key,
    label: value.label,
    count: value.count,
    power_mw: value.powerN ? Math.round(value.power * 10) / 10 : null,
    energy_mwh: value.energyN ? Math.round(value.energy * 10) / 10 : null,
  }));
  rows.sort((a, b) =>
    sort === "key"
      ? a.key.localeCompare(b.key, "zh-CN")
      : b.count - a.count || a.label.localeCompare(b.label, "zh-CN"),
  );
  if (options?.limit && rows.length > options.limit) {
    const head = rows.slice(0, options.limit);
    if (options.includeOther !== false) {
      const rest = rows.slice(options.limit);
      head.push({
        key: "__other__",
        label: "其他",
        count: rest.reduce((sum, row) => sum + row.count, 0),
        power_mw: rest.reduce(
          (sum, row) => sum + (row.power_mw ?? 0),
          0,
        ) || null,
        energy_mwh: rest.reduce(
          (sum, row) => sum + (row.energy_mwh ?? 0),
          0,
        ) || null,
      });
    }
    rows = head;
  }
  return rows;
}

/** Rough scene bucket: 发电侧 / 电网侧 / 用户侧 / 其他 */
export function classifyScene(scene: string | null | undefined): string {
  const text = (scene || "").trim();
  if (!text || text === "——" || text === "—") return "其他";
  if (/电源|发电/u.test(text)) return "发电侧";
  if (/电网/u.test(text)) return "电网侧";
  if (/用户/u.test(text)) return "用户侧";
  return "其他";
}

const DURATION_CANONICAL = [
  "≤1h",
  "1–2h",
  "2h",
  "2–4h",
  "4h",
  "≥4h",
  "未知",
] as const;

function hoursToDurationBucket(hours: number): string {
  if (hours <= 1) return "≤1h";
  if (hours < 2) return "1–2h";
  if (hours === 2) return "2h";
  if (hours < 4) return "2–4h";
  if (hours === 4) return "4h";
  return "≥4h";
}

/** Duration band for charts. */
export function classifyDuration(
  band: string | null | undefined,
  hours: number | null | undefined,
): string {
  const text = (band || "").replace(/\s+/g, "");
  if (text) {
    if (/未知|—|——|^-$/u.test(text)) return "未知";
    if (/^≤?1h$|^1h$|^<1h$|时长≤1|≤1小时/u.test(text)) return "≤1h";
    if (/1h<|1-2|1～2|1—2|1至2/u.test(text)) return "1–2h";
    if (/^2h$|＝2h|=2h/u.test(text)) return "2h";
    if (/2h<|2-4|2～4|2—4|2至4/u.test(text)) return "2–4h";
    if (/^4h$|＝4h|=4h/u.test(text)) return "4h";
    if (/4h<|≥4|≥ 4|>4/u.test(text)) return "≥4h";
    const parsed = Number(text.match(/(\d+(?:\.\d+)?)/u)?.[1]);
    if (Number.isFinite(parsed)) return hoursToDurationBucket(parsed);
  }
  if (hours == null || !Number.isFinite(hours)) return "未知";
  return hoursToDurationBucket(hours);
}

/** Collapse free-form duration labels into the 7 chart buckets. */
export function normalizeDurationBuckets(
  buckets: readonly AnalyticsBucket[],
): AnalyticsBucket[] {
  const merged = new Map<
    string,
    { label: string; count: number; power: number; energy: number }
  >();
  for (const key of DURATION_CANONICAL) {
    merged.set(key, { label: key, count: 0, power: 0, energy: 0 });
  }
  for (const bucket of buckets) {
    const key = DURATION_CANONICAL.includes(
      bucket.key as (typeof DURATION_CANONICAL)[number],
    )
      ? bucket.key
      : classifyDuration(bucket.key, null);
    const current = merged.get(key) ?? {
      label: key,
      count: 0,
      power: 0,
      energy: 0,
    };
    current.count += bucket.count;
    current.power += bucket.power_mw ?? 0;
    current.energy += bucket.energy_mwh ?? 0;
    merged.set(key, current);
  }
  return DURATION_CANONICAL.map((key) => {
    const value = merged.get(key)!;
    return {
      key,
      label: value.label,
      count: value.count,
      power_mw: value.power || null,
      energy_mwh: value.energy || null,
    };
  });
}

/** Tender/award scope family: EPC / 储能系统 / 电芯 / 其他 */
export function classifyScope(scope: string | null | undefined): string {
  const text = (scope || "").trim();
  if (!text || text === "——" || text === "—") return "其他";
  if (/电芯|电池芯|电芯模组/u.test(text)) return "电芯";
  if (/EPC|总承包|PC承包|设计施工/iu.test(text)) return "EPC";
  if (/储能系统|系统设备|储能柜|一体柜|BESS|电池系统/u.test(text)) {
    return "储能系统";
  }
  return "其他";
}

const DURATION_ORDER = ["≤1h", "1–2h", "2h", "2–4h", "4h", "≥4h", "未知"];
const SCENE_ORDER = ["发电侧", "电网侧", "用户侧", "其他"];
const SCOPE_ORDER = ["EPC", "储能系统", "电芯", "其他"];

export function buildBessProjectAnalytics(
  rows: readonly AnalyticsRow[],
): BessProjectAnalytics {
  const byMonth = new Map<
    string,
    { label: string; count: number; power: number; energy: number; powerN: number; energyN: number }
  >();
  const byProvince = new Map<
    string,
    { label: string; count: number; power: number; energy: number; powerN: number; energyN: number }
  >();
  const byScene = new Map<
    string,
    { label: string; count: number; power: number; energy: number; powerN: number; energyN: number }
  >();
  const byDuration = new Map<
    string,
    { label: string; count: number; power: number; energy: number; powerN: number; energyN: number }
  >();
  const byScope = new Map<
    string,
    { label: string; count: number; power: number; energy: number; powerN: number; energyN: number }
  >();

  for (const row of rows) {
    const monthKey =
      row.event_date && /^\d{4}-\d{2}/.test(row.event_date)
        ? row.event_date.slice(0, 7)
        : "未知";
    pushBucket(byMonth, monthKey, monthKey, row);

    const province = row.province_label?.trim() || "未知";
    pushBucket(byProvince, province, province, row);

    const scene = classifyScene(row.scene);
    pushBucket(byScene, scene, scene, row);

    const duration = classifyDuration(row.duration_band, row.duration_h);
    pushBucket(byDuration, duration, duration, row);

    const scope = classifyScope(row.scope_label);
    pushBucket(byScope, scope, scope, row);
  }

  const monthBuckets = toBuckets(byMonth, { sort: "key" });
  const provinceBuckets = toBuckets(byProvince, {
    sort: "count",
    limit: 10,
    includeOther: true,
  });
  const sceneBuckets = toBuckets(byScene, { sort: "count" }).sort(
    (a, b) => SCENE_ORDER.indexOf(a.key) - SCENE_ORDER.indexOf(b.key),
  );
  const durationBuckets = toBuckets(byDuration, { sort: "count" }).sort(
    (a, b) => {
      const ai = DURATION_ORDER.indexOf(a.key);
      const bi = DURATION_ORDER.indexOf(b.key);
      if (ai >= 0 || bi >= 0) {
        return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      }
      return a.label.localeCompare(b.label, "zh-CN");
    },
  );
  const scopeBuckets = toBuckets(byScope, { sort: "count" }).sort(
    (a, b) => SCOPE_ORDER.indexOf(a.key) - SCOPE_ORDER.indexOf(b.key),
  );

  return {
    sample_size: rows.length,
    by_month: monthBuckets,
    by_province: provinceBuckets,
    by_scene: sceneBuckets,
    by_duration: durationBuckets,
    by_scope: scopeBuckets,
  };
}
