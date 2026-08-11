import { describe, expect, it } from "vitest";

import {
  buildBessProjectAnalytics,
  classifyDuration,
  classifyScene,
  classifyScope,
} from "@/lib/bess-projects/analytics";

describe("bess project analytics classifiers", () => {
  it("buckets scenes into generation / grid / user", () => {
    expect(classifyScene("电源侧")).toBe("发电侧");
    expect(classifyScene("电网侧")).toBe("电网侧");
    expect(classifyScene("用户侧")).toBe("用户侧");
    expect(classifyScene("集采/框采")).toBe("其他");
  });

  it("normalizes duration bands", () => {
    expect(classifyDuration("2h", null)).toBe("2h");
    expect(classifyDuration("2h<时长<4h", null)).toBe("2–4h");
    expect(classifyDuration(null, 4)).toBe("4h");
    expect(classifyDuration(null, null)).toBe("未知");
  });

  it("classifies tender/award scope families", () => {
    expect(classifyScope("EPC")).toBe("EPC");
    expect(classifyScope("光储充EPC")).toBe("EPC");
    expect(classifyScope("储能系统")).toBe("储能系统");
    expect(classifyScope("电芯采购")).toBe("电芯");
    expect(classifyScope("容量租赁")).toBe("其他");
  });

  it("builds month / province / scene series", () => {
    const analytics = buildBessProjectAnalytics([
      {
        event_date: "2026-01-10",
        province_label: "广东",
        scene: "用户侧",
        duration_band: "2h",
        duration_h: 2,
        scope_label: "EPC",
        power_mw: 100,
        energy_mwh: 200,
      },
      {
        event_date: "2026-01-12",
        province_label: "广东",
        scene: "电网侧",
        duration_band: "4h",
        duration_h: 4,
        scope_label: "储能系统",
        power_mw: 50,
        energy_mwh: 200,
      },
      {
        event_date: "2026-02-01",
        province_label: "江苏",
        scene: "电源侧",
        duration_band: null,
        duration_h: 2,
        scope_label: "电芯",
        power_mw: null,
        energy_mwh: null,
      },
    ]);

    expect(analytics.sample_size).toBe(3);
    expect(analytics.by_month.map((item) => item.key)).toEqual([
      "2026-01",
      "2026-02",
    ]);
    expect(analytics.by_province[0]).toMatchObject({
      key: "广东",
      count: 2,
    });
    expect(analytics.by_scene.map((item) => item.key)).toEqual([
      "发电侧",
      "电网侧",
      "用户侧",
    ]);
    expect(analytics.by_scope.map((item) => item.key)).toEqual([
      "EPC",
      "储能系统",
      "电芯",
    ]);
  });
});
