# Grid Ledger 前后端接口契约

首次对齐基线：`dylan@be93eac`（2026-08-06）。机器可读的共享类型、路径清单和查询校验位于 `src/lib/api/contracts.ts`；导入、专题和领域写入体继续以各自的 Zod schema 为准，本文集中解释跨前后端语义和数据库边界。发生冲突时，以共享 TypeScript 契约、领域 schema、数据库迁移和实际路由测试共同校验，不允许只改本文。

## 1. 全局约定

### JSON 包络

- 成功：`{ "data": T }`
- 失败：`{ "error": { "code": string, "message"?: string, "issues"?: unknown, "fields"?: Record<string, string[]> } }`
- 参数或请求体不符合契约：HTTP `422`
- JSON 语法无效：HTTP `422`，`code = INVALID_JSON`；不得把坏 JSON 当成空对象继续执行任务
- 未登录 / 非管理员：HTTP `401` / `403`
- 记录不存在：HTTP `404`
- Supabase 未配置：HTTP `503`，`code = NOT_CONFIGURED`
- 未处理的数据库或服务错误：HTTP `500`，不向前端返回数据库技术细节

### 数据语义

- 所有 UUID 必须是标准 UUID；非法 UUID 在访问数据库前返回 `422`。
- 日期只接受真实存在的 `YYYY-MM-DD`，例如 `2026-02-30` 无效。
- 缺失数字必须是 `null`，前端展示为 `—`；真实数值 `0` 仍展示为 `0`。
- Viewer API 只返回已发布数据。前端过滤是二次防御，不替代 RLS。
- 管理员 JSON 写请求必须为同源 `application/json`，并持有 `app_metadata.role = admin` 的会话或 Bearer token。

## 2. 公开 Viewer API

| 方法 | 路径 | 查询参数 | `data` 类型 |
| --- | --- | --- | --- |
| GET | `/api/public/regions` | 无 | `Region[]` |
| GET | `/api/public/signals` | `region_id?`、`scope=descendants?`、`q?`（最多200字符）、`limit?`（1–100，默认100） | `PublicSignalDto[]` |
| GET | `/api/public/signals/{id}` | `id` 为 UUID | `PublicSignalDto` |
| GET | `/api/public/market-metrics` | `region_id?`、`scope=descendants?` | `MarketMetric[]` |
| GET | `/api/public/province-topics` | `region_id?`、`scope=descendants?`、`topic_id?` | `ProvinceTopicRecordWithFields[]` |
| GET | `/api/public/project-events` | 见下表 | `PublicBessProjectEventPage` |
| GET | `/api/public/project-events/{id}` | `id` 为 UUID | `PublicBessProjectEvent` |
| GET | `/api/public/project-events/analytics` | 见下表，不含分页 | `BessProjectAnalytics` |

### 项目与招标查询参数

| 参数 | 约束 | 语义 |
| --- | --- | --- |
| `event_type` | `tender` / `award` / `commissioning` | 单一事件轨道 |
| `province` | 最多200字符 | 精确省份展示名 |
| `scene` | 最多200字符 | 精确场景 |
| `plant_type` | 最多200字符 | 精确电站类型 |
| `q` | 最多200字符 | 项目、业主、集团、范围和原始省份搜索 |
| `region_ids` | 逗号分隔 UUID，1–100个 | 地区范围 |
| `include_unknown` | `0` / `1`，默认 `1` | 有地区范围时是否包含未映射事件 |
| `date_from` / `date_to` | 有效 `YYYY-MM-DD`，结束不得早于开始 | 闭区间事件日期 |
| `page` | 正整数，默认1 | 仅列表 API |
| `page_size` | 1–30，默认15 | 仅列表 API |

`PublicBessProjectEvent` 不包含以下数据库运维字段：`source_batch`、`source_row_hash`、`raw`、`is_published`、`created_at`、`updated_at`。候选人 DTO 不包含 `event_id` 和时间戳。`202608060002_bess_public_api_contract.sql` 在数据库层强制隐藏真正敏感的导入字段 `source_batch`、`source_row_hash` 和 `raw`；`is_published`、`created_at` 与候选人的 `event_id` 仍用于 PostgREST 过滤、排序和关联，因此数据库角色可读，但 Next Viewer DTO 必须显式删除。

列表响应的 `sources` 只来自当前返回页中的真实记录；空页必须返回 `[]`，不能硬编码数据源名称。

### 省级专题 ID

当前为 8 个专题、31省共 248 个专题单元：

1. `trading-rules`
2. `storage-capacity-compensation`
3. `ancillary-services`
4. `fourth-regulatory-cycle-grid-cost`
5. `storage-operating-costs`
6. `green-power-direct-connection`
7. `retail-rules`
8. `renewable-mechanism-price`

非法 `topic_id` 返回 `422`，不得静默当作“全部专题”。

## 3. 管理员 API

所有下列接口都要求管理员会话。列表接口返回数组，详情和写接口返回写入后的完整 Admin 记录。

| 方法 | 路径 | 请求体 / 查询 |
| --- | --- | --- |
| GET / POST | `/api/admin/signals` | GET：`region_id?`、`review_status?`、`q?`；POST：`signalDraftInputSchema` |
| GET / PATCH | `/api/admin/signals/{id}` | PATCH：`signalDraftInputSchema`；保存后回到 `pending_review` |
| POST | `/api/admin/signals/{id}/publish` | `{ reviewer_note: string }`；还必须通过发布门禁 |
| POST | `/api/admin/signals/{id}/reject` | `{ reviewer_note: string }`；不能为空 |
| GET / POST | `/api/admin/market-metrics` | GET：`region_id?`；POST：`marketMetricCreateSchema` |
| GET / PATCH | `/api/admin/market-metrics/{id}` | PATCH：`marketMetricUpdateSchema` |
| GET / POST | `/api/admin/cfd-auctions` | POST：`cfdAuctionCreateSchema` |
| GET / PATCH | `/api/admin/cfd-auctions/{id}` | PATCH：`cfdAuctionUpdateSchema` |
| GET / POST | `/api/admin/province-topics` | GET：`region_id?`、`topic_id?`、`review_status?`；POST：`provinceTopicDraftInputSchema` |
| GET / PATCH | `/api/admin/province-topics/{id}` | PATCH：`provinceTopicDraftInputSchema`；保存后回到 `pending_review` |
| POST | `/api/admin/province-topics/{id}/publish` | `{ reviewer_note: string }`；字段集合、主来源和字段证据必须完整 |
| POST | `/api/admin/province-topics/{id}/reject` | `{ reviewer_note: string }`；不能为空 |

Market Metric 与 CfD 的 URL 只接受 HTTP(S)。创建请求拒绝未知字段；PATCH 记录不存在时必须返回 `404`，不能把 PostgREST 的“0行”转成 `500`。

## 4. 导入与定时任务接口

| 方法 | 路径 | 契约 |
| --- | --- | --- |
| GET / POST | `/api/admin/imports` | GET 返回 `ImportJob[]`；POST 接受 URL JSON 或 PDF/XLSX/CSV multipart |
| POST | `/api/admin/imports/{id}/process` | `processImportSchema` |
| POST | `/api/admin/imports/{id}/suggest-mapping` | `suggestMappingSchema` |
| PATCH | `/api/admin/import-items/{id}` | `updateImportItemSchema` |
| POST | `/api/admin/import-items/{id}/approve` | `approveImportItemSchema`；只创建未发布正式草稿 |
| POST | `/api/admin/import-items/{id}/reject` | `rejectImportItemSchema` |
| POST | `/api/admin/policy-ingest/run` | 严格空对象 `{}` |
| GET / POST | `/api/cron/policy-ingest` | `Authorization: Bearer $CRON_SECRET` |

CESA 工作簿导入脚本不是浏览器 API，而是受信任运维入口。必须显式选择 `--draft` 或 `--publish`；每个 `source_batch` 的删除和重建必须在同一事务中完成，失败时回滚，不得留下半批数据。

## 5. Server Component 数据边界

首页、政策、市场和地区页面目前不是通过浏览器 HTTP 再取一次基础数据，而是 Server Component 经 `getPublicDashboardData()` 调用 Service/Repository。该路径必须遵守与 Viewer API 相同的发布过滤和 `NULL` 语义。

- Supabase 未配置：返回 `configured=false`，页面显示配置提示。
- Supabase 已配置但查询失败：抛出真实服务错误，由应用错误边界处理。
- 禁止在“已配置但数据库失败”时静默回退 Mock；否则缺迁移、RLS 或字段错误会被假数据掩盖。
- 项目事件使用分页 Viewer API 按需加载，不进入整页 RSC 基础数据包。

## 6. 数据库强制边界

| 数据集 | 公开条件 | 数据库保护 |
| --- | --- | --- |
| Signals | `review_status='published' AND published_at IS NOT NULL` | RLS、发布字段 CHECK、审核人绑定、公开列白名单 |
| Market Metrics | `is_published=true` | RLS；`value NULL` 与 `0` 分离 |
| Province Topics | `review_status='published' AND published_at IS NOT NULL` | RLS、字段集合与证据门禁、已发布字段锁 |
| China CfD | `is_published=true` | RLS；缺失价格/电量保持 `NULL` |
| BESS Project Events | `is_published=true` | RLS、候选人父记录检查、公开列级授权 |
| Import jobs/items | 不公开 | admin-only RLS / private Storage |

前端样式、布局或组件重构本身不会改数据库；会影响数据库的改动包括：请求字段/类型改变、路由查询语义改变、新迁移、发布状态改变、导入脚本和 RLS/授权改变。验收必须同时跑类型检查、单测、数据库 lint、RLS/发布流程和真实 HTTP 返回字段检查。
