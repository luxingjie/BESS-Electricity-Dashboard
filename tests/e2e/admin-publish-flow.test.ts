import { describe, expect, it } from "vitest";

import { SignalService } from "../../src/lib/services/signal-service";
import type { Actor } from "../../src/lib/types";
import { InMemorySignalRepository } from "../helpers/in-memory-signal-repository";

const SHANDONG_REGION_ID = "11111111-1111-4111-8111-111111111111";

function loginAsAdmin(email: string, password: string): Actor | null {
  if (email === "admin@grid-ledger.test" && password === "test-password") {
    return { id: "admin-e2e", role: "admin", email };
  }

  return null;
}

describe("administrator manual entry and publication flow", () => {
  it("logs in, saves a Shandong draft privately, publishes it, and opens its source", async () => {
    const repository = new InMemorySignalRepository();
    const service = new SignalService(
      repository,
      () => new Date("2026-07-22T10:00:00.000Z"),
    );

    // Administrator login.
    const actor = loginAsAdmin(
      "admin@grid-ledger.test",
      "test-password",
    );
    expect(actor?.role).toBe("admin");

    // Create a Demo Shandong policy and save it as a manual draft.
    const draft = await service.saveDraft(actor, {
      region_id: SHANDONG_REGION_ID,
      signal_type: "policy",
      title: "DEMO 山东省政策条目",
      summary: "该条目仅用于端到端工作流测试，不是真实市场数据。",
      category: "Demo policy",
      original_status: "Filed",
      normalized_status: "filed",
      event_date: "2026-07-22",
      source_url: "https://example.com/shandong-demo-policy",
      source_name: "Demo source",
      is_demo: true,
    });
    expect(draft.review_status).toBe("pending_review");

    // It must not appear in a public region list or public detail endpoint.
    await expect(
      service.listPublic({ region_id: SHANDONG_REGION_ID }),
    ).resolves.toEqual([]);
    await expect(service.getPublicById(draft.id)).resolves.toBeNull();

    // Publish after an explicit human confirmation.
    const published = await service.publish(
      actor,
      draft.id,
      "已人工核对归属、状态与原文链接",
    );
    expect(published.review_status).toBe("published");

    // The Shandong page can now find it.
    const shandongSignals = await service.listPublic({
      region_id: SHANDONG_REGION_ID,
    });
    expect(shandongSignals.map((signal) => signal.id)).toContain(draft.id);

    // Opening details exposes a valid, navigable original-source URL.
    const detail = await service.getPublicById(draft.id);
    expect(detail?.source_url).toBe(
      "https://example.com/shandong-demo-policy",
    );
    const originalSource = new URL(detail?.source_url ?? "");
    expect(originalSource.protocol).toBe("https:");
    expect(originalSource.pathname).toBe("/shandong-demo-policy");
  });
});
