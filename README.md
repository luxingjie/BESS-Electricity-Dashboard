# Grid Ledger — GL-MVP-002

可部署的人工录入、审核、发布与公开地区看板，并支持管理员导入单篇公开 URL、文本型 PDF、XLSX/CSV，生成可追溯的待审核草稿。AI 永不直接发布，也不运行定时扫描。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript
- Supabase PostgreSQL、Auth、Row Level Security
- Supabase 私有 Storage（原始 HTML、PDF、XLSX/CSV）
- OpenAI Responses API + Zod 严格结构化输出
- Cheerio、PDF.js、ExcelJS（安全提取与确定性表格映射）
- Zod 业务输入校验
- Vitest 单元与无浏览器端到端工作流测试
- Vercel（推荐 Web 部署）+ Supabase Cloud（数据库与认证）

原始视觉参考 `政策看板20260720.html` 保留不动；动态应用位于 `src/`。

## 本地运行

要求：Node.js 20.18.1+、npm、Docker Desktop，以及用于 AI 导入的 OpenAI API Key。

```bash
npm install
npm run db:start
npm run db:reset
cp .env.example .env.local
npm run dev
```

`npm run db:start` 会输出本地 Supabase API URL 和 anon key。将它们写入 `.env.local`：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local anon key>
OPENAI_API_KEY=<server-only OpenAI key>
CRON_SECRET=<server-only Bearer secret for /api/cron/policy-ingest>
SUPABASE_SERVICE_ROLE_KEY=<local service-role key; cron writes only>
# 可选，默认 gpt-5.6-terra
OPENAI_MODEL=gpt-5.6-terra
```

打开：

- 公开看板：<http://localhost:3000>
- 管理员登录：<http://localhost:3000/admin/login>
- 本地 Supabase Studio：<http://127.0.0.1:54323>

## 数据库初始化

迁移：

- `supabase/migrations/202607220001_initial_schema.sql`：初始 schema、RLS 与发布约束
- `supabase/migrations/202607220002_china_province_directory.sql`：大陆31省级地区参考目录
- `supabase/migrations/202607220003_add_continent_region_type.sql`：增加大洲地区类型（独立提交）
- `supabase/migrations/202607220004_global_region_directory.sql`：六大洲与代表国家目录，并将中国归入亚洲
- `supabase/migrations/202607220005_import_pipeline.sql`：私有 `import_jobs` / `import_items`、去重索引、审核状态与 RLS
- `supabase/migrations/202607220006_import_approval_rpc.sql`：管理员原子批准 RPC；只创建待审核 Signal 或未公开 Metric
- `supabase/migrations/202607220007_import_storage.sql`：私有 `grid-ledger-imports` bucket 与管理员对象策略
- `supabase/migrations/202607220008_service_role_maintenance.sql`：仅供受信任运维/本地 E2E 清理的 service-role SQL 权限；应用不使用该密钥
- `supabase/migrations/202607220009_excel_row_deduplication.sql`：同名来源工作簿的保守跨任务行级去重与管理员查询函数
- `supabase/migrations/202607220010_excel_row_deduplication_review_scope.sql`：已拒绝行允许在修正映射后重新导入，不被历史去重永久屏蔽

```bash
# 启动本地 Supabase，自动应用迁移与 seed
npm run db:start

# 从空库重放迁移与 seed
npm run db:reset
```

`supabase/seed.sql` 包含 62 个 Demo/参考 Region（全球、六个有人居住的大洲、24 个代表国家及中国大陆 31 个省级行政区）、4 条状态演示 Signal，以及 2 条 `value = NULL` 的市场指标。大洲与国家仅用于目录结构；全部业务夹具均标为 `DEMO`，不代表真实政策或市场数据。

### 创建管理员

seed 不创建账号或保存密码。先在 Supabase Dashboard/Studio 的 Authentication 页面创建邮箱密码用户，再在 SQL Editor 以受信任管理员身份执行：

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"admin"}'::jsonb
where email = 'admin@example.com';
```

角色修改后退出并重新登录，让新 JWT 携带 `app_metadata.role = admin`。授权不读取用户可自行修改的 `user_metadata`。

## 验证

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`npm run test:e2e` 是快速的领域工作流回归（内存仓储），不冒充浏览器/数据库集成测试。真实 HTTP + Supabase E2E 也不使用 Playwright；先启动本地 Supabase 和 Next.js，然后将 `npx supabase status -o env` 输出中的本地密钥传入：

```bash
# 终端 1
npm run db:start
npm run dev

# 终端 2；密钥仅用于本地测试进程，不要写入 NEXT_PUBLIC_* 或提交
APP_URL=http://127.0.0.1:3000 \
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=<local anon key> \
SUPABASE_SERVICE_ROLE_KEY=<local service-role key> \
npm run test:e2e:http
```

真实 E2E 覆盖：Supabase Auth 管理员登录、未登录 admin 重定向/API 401、新建山东草稿、RLS 与公开 API 均不可见、数据库发布门禁、发布、山东地区页可见、详情页原文链接可访问。service-role key 只用于创建和清理隔离的本地测试账号，应用运行时不需要它。

GL-MVP-002 的真实 CSV/Storage/批准闭环使用相同四个环境变量运行：

```bash
APP_URL=http://127.0.0.1:3000 \
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=<local anon key> \
SUPABASE_SERVICE_ROLE_KEY=<local service-role key> \
npm run test:e2e:imports
```

该脚本不调用外部 AI，覆盖匿名 401、CSV 私有预览/映射、重复文件复用、普通用户批准 403、管理员批准、未公开 Metric 隔离，以及山东 Signal 批准后仍隐藏、人工发布后公开列表/详情可见与 provenance 清理。脚本还包含同名更新版 CSV 行去重和 rejected 行重导回归，需先应用最新数据库迁移。URL/PDF 的真实模型烟测需另行提供 `OPENAI_API_KEY`。

## 页面

- `/`：公开全局看板、六大洲市场目录、地区选择、搜索、Published Signal、市场指标
- `/regions/[slug]`：大洲/国家/省级地区详情；大洲页递归汇总所属国家及其下级地区
- `/regions/china`：亚洲 → 中国入口下的大陆31个省级行政区 × 8类电力市场专题矩阵；无来源字段明确显示暂无已发布数据
- `/signals/[id]`：公开 Signal 详情与原文链接；草稿返回 404
- `/admin/login`：Supabase 邮箱密码登录
- `/admin`：受保护管理员工作台
- `/admin/signals`：列表、新建、编辑、保存草稿、发布、驳回
- `/admin/market-metrics`：市场指标新增与编辑
- `/admin/imports/new`：URL、PDF、XLSX/CSV 导入入口
- `/admin/imports`：导入任务与状态列表
- `/admin/imports/[id]`：任务详情、工作表预览和映射
- `/admin/imports/[id]/review`：原文/证据与结构化草稿左右审核

## API

公开 API：

- `GET /api/public/regions`
- `GET /api/public/signals?q=&region_id=&scope=`
- `GET /api/public/signals/:id`
- `GET /api/public/market-metrics?region_id=&scope=`

地区参数默认按 `region_id` 精确匹配；显式传入 `scope=descendants` 时读取该地区及全部下级节点。两种模式都继续受 Published 过滤和 RLS 约束。

管理员 API（必须登录且 `app_metadata.role=admin`）：

- `GET|POST /api/admin/signals`
- `GET|PATCH /api/admin/signals/:id`
- `POST /api/admin/signals/:id/publish`
- `POST /api/admin/signals/:id/reject`
- `GET|POST /api/admin/market-metrics`
- `GET|PATCH /api/admin/market-metrics/:id`
- `GET|POST /api/admin/imports`
- `POST /api/admin/imports/:id/process`
- `POST /api/admin/imports/:id/suggest-mapping`
- `PATCH /api/admin/import-items/:id`
- `POST /api/admin/import-items/:id/approve`
- `POST /api/admin/import-items/:id/reject`

## 导入流程与边界

- URL：规范化 → DNS/重定向逐次 SSRF 校验 → 固定已校验 IP 下载单页 HTML → 提取正文、canonical、meta/JSON-LD 和 PDF 附件链接 → 私有保存原 HTML → AI 严格 JSON → 人工审核。
- PDF：校验扩展名和 PDF magic → 私有保存 → 逐页提取文本并保留页码 → 扫描件停止且不调用 AI → AI 严格 JSON → 证据原文与页码校验 → 人工审核。当前不做 OCR。
- Excel/CSV：安全预检 → 私有保存 → 工作表和前 20 行预览 → AI 只建议表头映射 → 管理员确认 → 程序逐行确定性转换。宏、外部链接和公式代码不执行；空值与数值 0 分开保存。单个工作簿首版最多 500 个数据行、200 列；单元格、表头和全工作簿逻辑字符量均有上限，避免共享字符串导致内存和 JSON 展开放大。同名来源工作簿的更新版会按目标类型、工作表、原始行位置和标准化原始行核验历史条目；与现有草稿/待审/已批准项完全相同的行只在 Job 元数据记录跳过原因，不再生成可批准草稿。已拒绝项不屏蔽后续修正映射后的重新导入。

三个入口最终都只写私有 `import_items`。管理员“批准并创建草稿”后，数据库事务创建 `signals.review_status = pending_review` 或 `market_metrics.is_published = false`，仍需沿用 GL-MVP-001 的正式发布步骤。

当前 Vercel/Next 请求入口将单文件限制为 4 MiB，以留在平台请求体上限内；Storage bucket 本身限制 25 MiB。URL/PDF 的处理由显式管理员请求触发并记录数据库状态，没有引入 Redis 或后台队列。付费墙、登录站点、验证码、扫描 PDF、`.xls`、`.xlsm` 和自动来源扫描均不支持。

## 部署

完整步骤见 [docs/deployment.md](docs/deployment.md)。应用不需要 `SUPABASE_SERVICE_ROLE_KEY`；管理员写操作使用当前用户 JWT，并同时经过 Route Handler 管理员校验和数据库 RLS。
