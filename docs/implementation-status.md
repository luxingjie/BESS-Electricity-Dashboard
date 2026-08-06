# GL-MVP-002 Implementation Status

本状态表以已完成的 `GL-MVP-001`、中国/全球地区前端扩展，以及 `GL-MVP-002` 单篇 URL/PDF/Excel 人工审核导入为边界。自动来源扫描、OCR、登录站点抓取和八类专题的真实数据采集仍明确延期。

## GL-MVP-002 导入闭环

| 工作流 | 状态 | 验证 | 已知边界 |
|---|---|---|---|
| URL 单篇导入 | 完成 | URL 规范化、DNS 与重定向 SSRF 单测；HTML 元数据/正文/附件提取测试 | 不登录、不绕过验证码/付费墙、不递归爬取；URL/PDF AI 处理由显式管理员请求触发，没有后台队列 |
| PDF 导入 | 完成 | PDF magic、页数/大小/超时、分页文本、扫描件和证据页码测试 | 仅文本型 PDF；无 OCR；请求入口单文件上限 4 MiB |
| XLSX/CSV 导入 | 完成 | ZIP 预检、隐藏工作表、前20行、公式缓存、null/zero、多个工作表及标准化行 hash 测试 | 不支持 `.xls` / `.xlsm`；首版单文件最多500行；AI 建议表头映射，逐行转换由程序确定性执行 |
| AI 结构化草稿 | 完成（配置） | Zod 严格 schema、枚举/null/证据门禁测试；production build | 使用 OpenAI Responses API；真实模型调用需要部署方提供 `OPENAI_API_KEY`，自动测试不消耗外部 AI 配额 |
| 人工审核 | 完成 | 左右对照 UI、保存、批准/拒绝 API、数据库批准 RPC | 当前逐条审核；批量批准与“拆成多条”未实现 |
| 正式表写入 | 完成 | RPC 事务测试：Signal 只创建 `pending_review`；Metric 只创建 `is_published=false`；重复批准幂等 | 批准导入不等于正式发布，仍走 GL-MVP-001 发布流程 |
| 私有存储与权限 | 完成 | 私有 bucket、管理员 Storage RLS、import 表 admin-only RLS；迁移已在本地增量应用 | 没有管理员删除/保留期管理界面 |
| 去重 | 完成（基础） | normalized URL/content SHA-256、文件 SHA-256；同名来源工作簿按目标类型/sheet/行位置/标准化原始行跨任务核验；rejected 行重导语义检查 | Excel 来源身份只做文件名大小写与首尾空白归一；不猜测含版本号的改名文件，不做正式业务记录的语义合并或自动覆盖 |

### 明确没有实现

- 自动定时扫描、`source_feeds`、自主浏览 Agent 或无限爬虫。
- OCR、登录网站、验证码、付费墙绕过。
- Redis/Celery/Temporal；当前用数据库 Job 状态和显式处理请求。
- 自动发布、自动覆盖正式数据、知识图谱或事件融合。
- Excel 批量批准与单条 AI 草稿拆分；可作为后续小任务，不属于当前端到端最小闭环的阻断项。

| 工作流 | 状态 | 验证 | 已知缺口 |
|---|---|---|---|
| 仓库与原型盘点 | 完成 | 文件、依赖、Git、HTML 交互只读审计 | 输入中提到的 `Grid_Ledger_Immediate_MVP_Spec.md` 不存在 |
| 地区模型 | 完成 | migration/seed 空库重放；1 Global + 6 Continents + 24 Countries + 中国 31 Provinces 层级单测；公开地区 API | 代表国家可按后续需求继续调整；暂不做地区后台 CRUD |
| Signal 审核发布 | 完成 | 领域测试；真实 Auth/RLS/HTTP E2E；数据库发布触发器与约束 | AI 候选由上方独立导入审核区接入 |
| Market Metrics | 完成 | null/zero 单测；公开 RLS；Admin 新增/编辑页 | Demo seed 不包含虚构数值 |
| 公开看板 | 完成 | 首页六大洲目录；大洲递归范围；地区、搜索、详情与原文链接；中国31省×8专题读取独立发布数据 | 尚未录入真实专题数据时保持明确空态 |
| Admin | 完成 | 未登录重定向/API 401；真实 Supabase Admin Auth；Signal、Metric、八专题草稿/发布入口 | 单管理员角色，无复杂 RBAC |
| 部署 | 完成（配置） | `next build`；Supabase 空库 reset；Vercel/Supabase 部署手册 | 未持有业务方云项目/域名，未执行远程上线 |
| AI 抓取与 URL/PDF/Excel 导入 | 完成 | 见上方 GL-MVP-002 导入闭环 | 自动来源扫描仍延期 |

## 中国八类专题数据接入边界

当前实现是与现有八专题前端直接对齐的“人工审核发布读模型”：`china_province_topic_records` 保存省份×专题发布单元，`china_province_topic_fields` 保存字段值、覆盖状态和字段级来源定位。它解决管理员无入口和公开端无真实数据契约的问题，但不宣称已经完成 Working Spec 中更长期的 `DocumentVersion → Event → Fact → 八类专用明细表` 全证据架构；复杂价表多行、辅助服务多品种和同字段多 Fact 关系仍需后续专用模型承接。

| 专题 | 模型 | 来源 | API | UI | 测试 | 真实数据覆盖率 |
|---|---|---|---|---|---|---|
| 省级电力市场交易规则 | 独立记录/字段模型完成 | 管理员人工录入及字段级证据 | 专题 Admin/Public API 完成 | 已发布值、状态、来源展示完成 | Taxonomy/服务/发布隔离测试 | 尚未录入真实数据 |
| 省级储能容量补偿/容量电价 | 独立记录/字段模型完成；与用网成本隔离 | 管理员人工录入及字段级证据 | 专题 Admin/Public API 完成 | 已发布值、状态、来源展示完成 | Taxonomy/服务/发布隔离测试 | 尚未录入真实数据 |
| 省级辅助服务品种与金额 | 独立记录/字段模型完成 | 管理员人工录入及字段级证据 | 专题 Admin/Public API 完成 | 已发布值、状态、来源展示完成 | Taxonomy/服务/发布隔离测试 | 尚未录入真实数据 |
| 第四监管周期价表与线损率 | 独立记录/字段模型完成；与储能收益隔离 | 管理员人工录入及字段级证据 | 专题 Admin/Public API 完成 | 已发布值、状态、来源展示完成 | Taxonomy/服务/发布隔离测试 | 尚未录入真实数据 |
| 省级储能系统运行费用 | 独立记录/字段模型完成 | 管理员人工录入及字段级证据 | 专题 Admin/Public API 完成 | 已发布值、状态、来源展示完成 | Taxonomy/服务/发布隔离测试 | 尚未录入真实数据 |
| 省级绿电直连政策 | 独立记录/字段模型完成 | 管理员人工录入及字段级证据 | 专题 Admin/Public API 完成 | 已发布值、状态、来源展示完成 | Taxonomy/服务/发布隔离测试 | 尚未录入真实数据 |
| 省级电力零售规则 | 独立记录/字段模型完成 | 管理员人工录入及字段级证据 | 专题 Admin/Public API 完成 | 已发布值、状态、来源展示完成 | Taxonomy/服务/发布隔离测试 | 尚未录入真实数据 |
| 风光机制电价（136号文） | 独立记录/字段模型完成；与储能容量补偿和用网成本隔离 | 管理员人工录入及字段级证据 | 专题 Admin/Public API 完成 | 已发布值、状态、来源展示完成 | Taxonomy/迁移 allow-list/发布隔离测试 | 尚未录入真实数据 |

## 省级八专题对齐验证记录

- `npx supabase migration up --local`：成功应用 `202607220010`、`202607240001_china_province_topic_module.sql`、`202607240002_lock_published_topic_fields.sql` 和 `202607240003_allow_topic_record_cascade_delete.sql`。
- `npx supabase db lint --local --level warning`：`public` / `extensions` schema 无错误。
- 数据库回滚事务：匿名角色只能读取已发布专题记录及其字段，不能读取同省同专题待审草稿；已发布字段不能被直接修改，必须先退回待审；验证未留下测试记录。
- `npm test`：15 个测试文件、72 项通过；包含专题字段集合、数据库 allow-list 对齐、null/zero、字段级来源门禁和服务层二次发布过滤。
- `npm run lint`、`npm run typecheck`、`npm run build`：全部通过；生产构建包含 3 个专题 Admin 页面、5 个专题 API 路由。
- 本机真实 HTTP E2E：临时管理员登录后完成专题草稿创建、匿名/RLS 隔离、人工发布、公开 API 与山东页面字段显示，并确认已发布子字段不可直接修改。
- E2E 清理复核：临时 Signal、专题记录和 Auth 管理员账号计数均为 0。级联删除触发器缺陷在首次清理审计中被发现并由 `202607240003` 修复；修复后完整复跑通过。
- 尚未录入真实业务数据；工程闭环通过不代表任一省份已有真实专题覆盖。

## GL-MVP-002 验证记录

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：14 个测试文件、65 项通过（含导入解析、AI 严格 schema/重试、SSRF、工作簿资源上限与行级去重测试）。
- `npm run build`：Next.js 16.2.11 production build 通过，包含 4 个导入后台页面和 6 个导入 API 路由。
- `npx supabase migration up --local`：在保留既有本地数据的情况下成功应用 `202607220005`—`202607220009`；`202607220010` 已写入仓库，但本轮本地 CLI 写入授权未通过，仍需执行一次迁移命令。
- `node scripts/import-http-e2e.mjs`：真实 Auth/RLS/Storage/HTTP 闭环通过，覆盖匿名 401、CSV 预览/映射、重复上传复用、非管理员批准 403、Metric 未公开隔离，以及山东 Signal 批准后仍隐藏、人工发布后公开列表/详情可见、provenance 与零残留清理。
- URL/PDF 的真实 AI 调用未在无密钥自动测试中伪装为已验证；部署方需提供 `OPENAI_API_KEY` 后做一次小样本烟测。
- `npm audit --omit=dev`：当前上游最新 Next.js/ExcelJS 依赖树仍报告 5 项告警（3 moderate、2 high）；本应用不接收 CSS/图片导入，ExcelJS 也不使用 uuid buffer API。已记录上游风险，没有执行会将 Next.js 降级到 9.x 的 `--force`。

## GL-MVP-001 保留验证记录

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：7 个测试文件、26 项通过。
- `npm run test:e2e`：1 项领域工作流通过（快速回归）。
- `npm run build`：Next.js 16.2.11 production build 通过，22 个页面/API 路由生成成功。
- `npx supabase db reset --local`：从空库重放 migration 和 seed 通过。
- `npx supabase migration up --local`：31省、大洲枚举与全球目录增量迁移通过。
- `npm run test:e2e:http`：真实 Supabase Auth、RLS、Next API/页面发布闭环通过；在空库 reset 后复跑仍通过。

HTTP E2E 覆盖未登录 Admin 保护、山东草稿公开隔离、匿名 Data API RLS、数据库发布门禁、管理员发布、山东地区页、Signal 详情以及原文链接可访问。测试完成后临时管理员和 Signal 自动清理。

全球目录回归还覆盖：六大洲与 24 个代表国家的唯一层级、中国仍直辖 31 个省级节点、公开 API 默认精确地区查询，以及显式 `scope=descendants` 时的递归查询。递归只扩大地区 ID 范围，不改变 Published 与 RLS 边界。
