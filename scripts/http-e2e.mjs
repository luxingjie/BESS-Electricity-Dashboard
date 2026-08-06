import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

const required = [
  "APP_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const appUrl = process.env.APP_URL.replace(/\/$/, "");
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `grid-ledger-e2e-${runId}@example.com`;
const password = `E2E-${runId}-Strong!`;

const authAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicAnon = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId;
let signalId;
let provinceTopicId;
let adminDb;

async function json(url, init) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  return { response, body };
}

try {
  const { data: created, error: createError } = await authAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });
  assert.ifError(createError);
  assert.ok(created.user?.id, "Supabase Auth should create the E2E admin");
  userId = created.user.id;

  const { data: login, error: loginError } = await anon.auth.signInWithPassword({ email, password });
  assert.ifError(loginError);
  assert.ok(login.session?.access_token, "Admin login should return a real access token");
  const accessToken = login.session.access_token;
  const bearerHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
  };
  adminDb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const anonymousAdminPage = await fetch(`${appUrl}/admin`, { redirect: "manual" });
  assert.ok([303, 307, 308].includes(anonymousAdminPage.status));
  assert.equal(new URL(anonymousAdminPage.headers.get("location"), appUrl).pathname, "/admin/login");

  const anonymousAdminApi = await json(`${appUrl}/api/admin/signals`);
  assert.equal(anonymousAdminApi.response.status, 401);

  const malformedAdminMutation = await json(`${appUrl}/api/admin/signals`, {
    method: "POST",
    headers: bearerHeaders,
    body: "{",
  });
  assert.equal(malformedAdminMutation.response.status, 422);
  assert.equal(malformedAdminMutation.body?.error?.code, "INVALID_JSON");

  const authorizedAdminPage = await fetch(`${appUrl}/admin`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(authorizedAdminPage.status, 200);
  assert.match(await authorizedAdminPage.text(), /管理员工作台/);

  const regionsResult = await json(`${appUrl}/api/public/regions`);
  assert.equal(regionsResult.response.status, 200);
  const shandong = regionsResult.body.data.find((region) => region.slug === "shandong");
  assert.ok(shandong?.id, "Shandong seed region should exist");

  const title = `DEMO 山东 HTTP E2E ${runId}`;
  const sourceUrl = `${appUrl}/api/public/regions`;
  const draftResult = await json(`${appUrl}/api/admin/signals`, {
    method: "POST",
    headers: bearerHeaders,
    body: JSON.stringify({
      region_id: shandong.id,
      signal_type: "policy",
      title,
      summary: "仅用于真实 HTTP/Supabase 端到端测试，不代表真实政策或市场数据。",
      category: "E2E Demo",
      original_status: "Filed",
      normalized_status: "filed",
      event_date: "2026-07-22",
      source_url: sourceUrl,
      source_name: "Grid Ledger local E2E source",
      reviewer_note: "",
      is_demo: true,
    }),
  });
  assert.equal(draftResult.response.status, 201, JSON.stringify(draftResult.body));
  signalId = draftResult.body.data.id;
  assert.equal(draftResult.body.data.review_status, "pending_review");

  const draftDetail = await fetch(`${appUrl}/api/public/signals/${signalId}`);
  assert.equal(draftDetail.status, 404);
  const draftList = await json(`${appUrl}/api/public/signals?region_id=${shandong.id}`);
  assert.equal(draftList.response.status, 200);
  assert.ok(!draftList.body.data.some((signal) => signal.id === signalId));

  const { data: anonymousRows, error: anonymousReadError } = await publicAnon
    .from("signals")
    .select("id,review_status")
    .eq("id", signalId);
  assert.ifError(anonymousReadError);
  assert.deepEqual(anonymousRows, [], "RLS must hide the draft from direct Data API reads");

  const { error: invalidPublishError } = await adminDb
    .from("signals")
    .update({ review_status: "published" })
    .eq("id", signalId);
  assert.ok(invalidPublishError, "The database publication constraint must reject missing human confirmation");

  const publishResult = await json(`${appUrl}/api/admin/signals/${signalId}/publish`, {
    method: "POST",
    headers: bearerHeaders,
    body: JSON.stringify({ reviewer_note: "已人工确认地区、状态、摘要和原文链接" }),
  });
  assert.equal(publishResult.response.status, 200, JSON.stringify(publishResult.body));
  assert.equal(publishResult.body.data.review_status, "published");
  assert.equal(publishResult.body.data.reviewer_id, userId);

  const publishedList = await json(`${appUrl}/api/public/signals?region_id=${shandong.id}&q=${encodeURIComponent(runId)}`);
  assert.equal(publishedList.response.status, 200);
  const publicSignal = publishedList.body.data.find((signal) => signal.id === signalId);
  assert.ok(publicSignal, "Published Signal should be visible on the Shandong public query");
  assert.equal("reviewer_id" in publicSignal, false, "Viewer API must omit internal reviewer UUIDs");
  assert.equal("created_by" in publicSignal, false, "Viewer API must omit creator UUIDs");

  const regionPage = await fetch(`${appUrl}/regions/shandong`);
  assert.equal(regionPage.status, 200);
  assert.match(await regionPage.text(), new RegExp(runId));

  const detailPage = await fetch(`${appUrl}/signals/${signalId}`);
  assert.equal(detailPage.status, 200);
  const detailHtml = await detailPage.text();
  assert.match(detailHtml, new RegExp(runId));
  assert.ok(detailHtml.includes(sourceUrl), "Detail page should render the original-source link");

  const originalSource = await fetch(sourceUrl);
  assert.equal(originalSource.status, 200, "The original-source link should be visitable");

  const provinceTopicTitle = `[DEMO] 山东八专题 HTTP E2E ${runId}`;
  const provinceTopicDraft = await json(`${appUrl}/api/admin/province-topics`, {
    method: "POST",
    headers: bearerHeaders,
    body: JSON.stringify({
      region_id: shandong.id,
      topic_id: "trading-rules",
      title: provinceTopicTitle,
      summary: "仅用于验证省级八专题录入、证据、审核发布和公开展示，不代表真实市场规则。",
      legal_status: "effective",
      operational_status: "continuous",
      valid_from: "2026-01-01",
      valid_to: "",
      as_of_date: "2026-07-24",
      source_url: sourceUrl,
      source_name: "Grid Ledger local topic E2E source",
      source_published_at: "2026-01-01",
      reviewer_note: "",
      is_demo: true,
      fields: [
        {
          field_key: "spot_day_ahead_rule",
          value_text: `[DEMO] 日前规则 ${runId}`,
          value_numeric: null,
          unit: "",
          coverage_status: "available",
          applicability: "仅用于本地 E2E",
          source_url: "",
          source_name: "",
          source_locator: "测试来源响应，第 1 项",
          evidence_excerpt: "工程验证字段，不是业务事实。",
        },
        {
          field_key: "spot_real_time_rule",
          value_text: "",
          value_numeric: null,
          unit: "",
          coverage_status: "not_published",
          applicability: "",
          source_url: "",
          source_name: "",
          source_locator: "",
          evidence_excerpt: "工程验证缺失状态。",
        },
        {
          field_key: "ancillary_trading_rule",
          value_text: "",
          value_numeric: null,
          unit: "",
          coverage_status: "not_covered",
          applicability: "",
          source_url: "",
          source_name: "",
          source_locator: "",
          evidence_excerpt: "",
        },
        {
          field_key: "retail_trading_rule",
          value_text: "",
          value_numeric: null,
          unit: "",
          coverage_status: "not_applicable",
          applicability: "",
          source_url: "",
          source_name: "",
          source_locator: "",
          evidence_excerpt: "仅验证不适用状态。",
        },
      ],
    }),
  });
  assert.equal(
    provinceTopicDraft.response.status,
    201,
    JSON.stringify(provinceTopicDraft.body),
  );
  provinceTopicId = provinceTopicDraft.body.data.id;
  assert.equal(provinceTopicDraft.body.data.review_status, "pending_review");
  assert.equal(
    provinceTopicDraft.body.data.fields[0].source_url,
    sourceUrl,
    "Blank field source should be stored as an explicit copy of the main source",
  );

  const hiddenTopicList = await json(
    `${appUrl}/api/public/province-topics?region_id=${shandong.id}&topic_id=trading-rules`,
  );
  assert.equal(hiddenTopicList.response.status, 200);
  assert.ok(
    !hiddenTopicList.body.data.some((record) => record.id === provinceTopicId),
    "Pending topic draft must stay out of the public API",
  );

  const { data: anonymousTopicRows, error: anonymousTopicReadError } =
    await publicAnon
      .from("china_province_topic_records")
      .select("id,review_status")
      .eq("id", provinceTopicId);
  assert.ifError(anonymousTopicReadError);
  assert.deepEqual(
    anonymousTopicRows,
    [],
    "RLS must hide the topic draft from direct Data API reads",
  );

  const publishTopicResult = await json(
    `${appUrl}/api/admin/province-topics/${provinceTopicId}/publish`,
    {
      method: "POST",
      headers: bearerHeaders,
      body: JSON.stringify({
        reviewer_note: "已人工确认专题字段、覆盖状态和字段级来源定位",
      }),
    },
  );
  assert.equal(
    publishTopicResult.response.status,
    200,
    JSON.stringify(publishTopicResult.body),
  );
  assert.equal(publishTopicResult.body.data.review_status, "published");
  assert.equal(publishTopicResult.body.data.reviewer_id, userId);

  const publishedTopicList = await json(
    `${appUrl}/api/public/province-topics?region_id=${shandong.id}&topic_id=trading-rules`,
  );
  assert.equal(publishedTopicList.response.status, 200);
  const publicTopic = publishedTopicList.body.data.find(
    (record) => record.id === provinceTopicId,
  );
  assert.ok(publicTopic, "Published topic record should be visible");
  assert.equal(
    publicTopic.fields.find(
      (field) => field.field_key === "spot_day_ahead_rule",
    )?.value_text,
    `[DEMO] 日前规则 ${runId}`,
  );
  assert.equal("reviewer_id" in publicTopic, false);
  assert.equal("created_by" in publicTopic, false);

  const publishedFieldId = publishTopicResult.body.data.fields[0].id;
  const { error: immutableFieldError } = await adminDb
    .from("china_province_topic_fields")
    .update({ value_text: "不应允许绕过审核修改" })
    .eq("id", publishedFieldId);
  assert.ok(
    immutableFieldError,
    "Published topic fields must be immutable until the parent returns to draft",
  );

  const topicRegionPage = await fetch(`${appUrl}/regions/shandong`);
  assert.equal(topicRegionPage.status, 200);
  assert.ok(
    (await topicRegionPage.text()).includes(`[DEMO] 日前规则 ${runId}`),
    "Published topic value should render in the Shandong page HTML",
  );

  process.stdout.write(
    "HTTP E2E passed: Auth → Signal publish → province-topic draft isolation → publish → immutable fields → public page\n",
  );
} finally {
  if (provinceTopicId && adminDb) {
    const { error: topicResetError } = await adminDb
      .from("china_province_topic_records")
      .update({
        review_status: "pending_review",
        published_at: null,
        reviewer_id: null,
        reviewed_at: null,
      })
      .eq("id", provinceTopicId);
    assert.ifError(topicResetError);
    const { error: topicDeleteError } = await adminDb
      .from("china_province_topic_records")
      .delete()
      .eq("id", provinceTopicId);
    assert.ifError(topicDeleteError);
  }
  if (signalId && adminDb) {
    await adminDb.from("signals").delete().eq("id", signalId);
  }
  if (userId) {
    await authAdmin.auth.admin.deleteUser(userId);
  }
}
