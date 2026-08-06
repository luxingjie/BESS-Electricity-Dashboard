# Grid Ledger MVP 数据字典

本文档对应当前仓库截至 `202608060002` 的迁移，包括 GL-MVP-001 正式表、地区目录、八专题、CfD、BESS 项目事件，以及 GL-MVP-002 私有导入暂存、批准事务、Excel 行去重和受信任运维权限。对外读取边界由 PostgreSQL Row Level Security（RLS）和必要的列级授权强制，不仅依赖前端过滤。

## 枚举

### `region_type`

| 值 | 含义 |
| --- | --- |
| `global` | 全球根节点 |
| `continent` | 大洲；全球市场的第一层目录 |
| `country` | 国家；大洲下的代表市场 |
| `province` | 省级地区；中国 MVP 下钻层级 |

### `review_status`

| 值 | 含义 | 公开可见 |
| --- | --- | --- |
| `ai_draft` | AI/程序刚生成、尚未进入人工复核的内部状态 | 否 |
| `pending_review` | 人工录入草稿/待审核，新建记录默认值 | 否 |
| `published` | 已完成人工确认并发布 | 是 |
| `rejected` | 已驳回 | 否 |

### `normalized_status`

`draft` 、`consultation` 、`filed` 、`approved` 、`effective` 、`suspended` 、`other` 为七个互相独立的值。`filed` 不等于 `approved`，`draft` / `consultation` 不等于 `effective`。不允许使用某一状态代替另一状态。

### 导入枚举

- `import_input_type`：`url` / `pdf` / `excel`（CSV 归入 `excel`）。
- `import_job_status`：`pending` / `processing` / `review` / `completed` / `partial_failed` / `failed`。
- `import_target_type`：`signal` / `market_metric` / `unknown`。
- `import_item_review_status`：`ai_draft` / `pending_review` / `approved` / `rejected` / `import_failed`。

## `regions`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | 是 | 主键，默认随机 UUID |
| `slug` | `text` | 是 | 公开路由键，全局唯一 |
| `code` | `text` | 否 | 稳定代码；非空值全局唯一 |
| `name_zh` | `text` | 是 | 中文名 |
| `name_en` | `text` | 否 | 英文名 |
| `region_type` | `region_type` | 是 | `global` / `continent` / `country` / `province` |
| `parent_id` | `uuid` | 否 | 自关联父节点；全球节点必须为空 |
| `is_demo` | `boolean` | 是 | 是否为演示/fixture 记录 |
| `created_at` | `timestamptz` | 是 | 创建时间 |
| `updated_at` | `timestamptz` | 是 | 更新时间，由触发器自动维护 |

初始 seed 的层级为 `全球 → 六大洲 → 24 个代表国家 → 中国大陆 31 个省级行政区`。中国的父节点为亚洲，31 个省级节点的直接父节点仍为中国；其他国家暂不建立省级层级。六大洲指亚洲、欧洲、北美洲、南美洲、大洋洲、非洲，不建立南极洲市场目录。目录记录全部显式标记为 Demo/参考项，但真实 Signal 不会因其 Region 为 Demo 而继承 Demo 标记。

## `signals`

| 字段 | 类型 | 草稿可空 | 发布必填 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | 否 | 是 | 主键 |
| `region_id` | `uuid` | 是 | 是 | 所属地区 |
| `signal_type` | `text` | 否 | 否 | 信号类型，默认 `policy` |
| `title` | `text` | 是 | 是 | 标题；发布时不允许空白字符串 |
| `summary` | `text` | 是 | 是 | 摘要；发布时不允许空白字符串 |
| `category` | `text` | 是 | 否 | 业务分类 |
| `original_status` | `text` | 是 | 否 | 原文状态描述，不覆盖标准化状态 |
| `normalized_status` | `normalized_status` | 是 | 是 | 人工确认的标准化状态 |
| `event_date` | `date` | 是 | 否 | 事件日期 |
| `effective_date` | `date` | 是 | 否 | 生效日期；不能根据 filed/approved 自动推断 |
| `impact_channel` | `text` | 是 | 否 | 影响渠道 |
| `impact_direction` | `text` | 是 | 否 | 影响方向 |
| `impact_level` | `text` | 是 | 否 | 影响等级 |
| `source_url` | `text` | 是 | 是 | 原文链接；发布时不允许空白字符串 |
| `source_name` | `text` | 是 | 否 | 来源名称 |
| `reviewer_note` | `text` | 是 | 是 | 人工审核说明；发布时不允许空白字符串 |
| `review_status` | `review_status` | 否 | 是 | 审核状态，默认 `pending_review` |
| `published_at` | `timestamptz` | 是 | 是 | 发布时间 |
| `reviewer_id` | `uuid` | 是 | 是 | 审核人 UUID |
| `reviewed_at` | `timestamptz` | 是 | 是 | 人工审核时间 |
| `created_by` | `uuid` | 是 | 否 | 创建人 UUID |
| `is_demo` | `boolean` | 否 | 是 | 演示数据标记 |
| `created_at` | `timestamptz` | 否 | 是 | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 是 | 更新时间，由触发器自动维护 |

发布约束由 `signals_published_fields_required` 在数据库层执行。即使绕过应用校验，缺少 `region_id`、`title`、`summary`、`source_url`、`normalized_status`、`reviewer_note`、`reviewer_id`、`reviewed_at` 或 `published_at` 中任一项的记录也无法设为 `published`。

`signals_published_source_is_http` 只允许已发布记录使用 HTTP(S) 原文链接。`signals_bind_reviewer` 触发器会在认证管理员发布或更新已发布记录时，用当前 `auth.uid()` 和数据库时间覆盖客户端提交的 `reviewer_id` / `reviewed_at`；客户端不能伪造审核身份。受信任的本地 seed/service role 可保留明确的 Demo 审核 UUID。

`reviewer_id` 和 `created_by` 故意不对 `auth.users` 建立外键：生产操作存储 Auth 用户 UUID；seed 则使用明确标注的固定 DEMO UUID，且不会创建伪造的账号。

## `market_metrics`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | 是 | 主键 |
| `region_id` | `uuid` | 是 | 所属地区 |
| `metric_key` | `text` | 是 | 稳定机器键 |
| `label` | `text` | 是 | 界面显示名 |
| `value` | `numeric` | 否 | 指标数值；缺失时必须保留 `NULL`，禁止转为 `0` |
| `unit` | `text` | 否 | 单位 |
| `period_label` | `text` | 否 | 期间/预测窗口标签 |
| `as_of_date` | `date` | 否 | 数据时点 |
| `source_url` | `text` | 否 | 来源链接 |
| `source_name` | `text` | 否 | 来源名 |
| `notes` | `text` | 否 | 口径、覆盖或数据不足说明 |
| `is_demo` | `boolean` | 是 | 演示数据标记 |
| `is_published` | `boolean` | 是 | 是否允许公开读取 |
| `created_at` | `timestamptz` | 是 | 创建时间 |
| `updated_at` | `timestamptz` | 是 | 更新时间，由触发器自动维护 |

seed 中的市场指标仅为工程夹具：`is_demo = true`、`value = NULL`，标题和备注都显式标记 `DEMO`。它们不表示真实市场数据。

## `china_province_topic_records`

中国省份 × 八大专题的审核发布单元。该表不保存通用事件，也不替代 `market_metrics`；它承载前端省级专题矩阵中一组字段共同的省份、专题、状态、有效期和主来源。

| 字段 | 类型 | 必填 | 发布必填 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | 是 | 是 | 主键 |
| `region_id` | `uuid` | 是 | 是 | 必须是 `parent.code = CN` 的省级地区 |
| `topic_id` | `province_topic_id` | 是 | 是 | 八大专题稳定 ID |
| `title` | `text` | 否 | 是 | 本次核验/发布记录标题 |
| `summary` | `text` | 否 | 否 | 适用范围、口径和不能推断的事项 |
| `legal_status` | `province_topic_legal_status` | 否 | 是 | 文件法律/政策状态 |
| `operational_status` | `province_topic_operational_status` | 否 | 否 | 市场运行阶段；不得代替法律状态 |
| `valid_from` / `valid_to` | `date` | 否 | 否 | 规则有效期，结束日不得早于开始日 |
| `as_of_date` | `date` | 否 | 是 | 人工核验截至日期 |
| `source_url` / `source_name` | `text` | 否 | 是 | 本条记录的主来源；发布链接仅允许 HTTP(S) |
| `source_published_at` | `date` | 否 | 否 | 主来源发布日期 |
| `reviewer_note` | `text` | 否 | 是 | 人工审核说明 |
| `review_status` | `review_status` | 是 | 是 | 草稿、待审、已发布或驳回 |
| `published_at` / `reviewer_id` / `reviewed_at` | 时间/UUID | 否 | 是 | 发布身份和时间由服务端及数据库触发器绑定 |
| `is_demo` | `boolean` | 是 | 是 | Demo 标记 |

发布时数据库会确认所属地区确为中国省级节点、该专题拥有规定数量的字段行，并且所有有值字段均具有字段级来源。已发布记录的子字段不可被直接增删改；应用必须先将父记录退回 `pending_review`，编辑后重新发布。

## `china_province_topic_fields`

每行对应公开专题页面的一张字段卡片。字段集合由共享 Taxonomy 决定；管理员表单、领域服务、数据库校验和公开页面使用同一组专题/字段键。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `record_id` | `uuid` | 是 | 所属专题发布记录 |
| `field_key` | `text` | 是 | 专题内稳定字段键；数据库拒绝跨专题字段 |
| `value_text` | `text` | 否 | 按原文保留的展示值、公式或规则摘要 |
| `value_numeric` | `numeric` | 否 | 仅供未来同口径比较；不能替代原始展示值 |
| `unit` | `text` | 否 | 原始单位，不自动换算 |
| `coverage_status` | `province_topic_field_coverage_status` | 是 | `available`、`not_covered`、`not_published`、`not_applicable`、`stale` 或 `conflicting` |
| `applicability` | `text` | 否 | 电压等级、项目类型、用户类别、执行地区等 |
| `source_url` / `source_name` | `text` | 否 | 字段来源；表单留空时保存为主来源的显式副本 |
| `source_locator` | `text` | 否 | 页码、表名、行列、条款或段落定位；有值字段发布时必填 |
| `evidence_excerpt` | `text` | 否 | 短摘录或核验备注 |
| `sort_order` | `integer` | 是 | 由 Taxonomy 确定的展示顺序 |

缺失值必须使用 `NULL + coverage_status`，不能写成 0。原文明确为零时，`value_text = '0'` 且可同时保存 `value_numeric = 0`。

## `china_cfd_auctions`

中国省级风光机制电价竞价结果表。`region_id` 指向标准省级地区，`province_label` 可保留冀北/冀南、蒙东/蒙西等电网展示口径。价格、电量、认购率和期限均允许 `NULL`；`NULL` 表示未公布，不能转换为 0。只有 `is_published=true` 的记录可被公开读取。

## `bess_project_events`

储能招标、中标和并网事件表，`event_type` 为 `tender`、`award` 或 `commissioning`。`region_id` 可空：跨省或无法可靠映射的记录保留 `province_label='未知'`。功率、电量、时长、预算和单价均允许 `NULL`，且不允许前端把缺失值显示成 0。

`source_batch`、`source_row_hash` 和 `raw` 只用于受信任导入的幂等、追踪与问题定位，不属于 Viewer API。匿名和普通登录用户在数据库列级授权上也不能读取这些字段。CESA 重导入以 `source_batch` 为单位在单一事务内替换；必须显式选择草稿或发布模式。

## `bess_award_candidates`

中标事件的候选人明细，通过 `event_id` 级联关联 `bess_project_events`。只有父事件已经发布时才允许公开读取候选人；Viewer DTO 不返回内部关联键和时间戳。

## `import_jobs`

私有导入任务。保存输入类型、URL/文件名、私有 Storage 路径、MIME/大小、原文件与内容 SHA-256、提取文本、工作表预览/映射等 `input_metadata`、任务计数、失败阶段、用户错误、私有技术错误、重试标记以及创建人/时间。URL 使用 normalized/canonical/content hash 基础去重；PDF/XLSX/CSV 使用原文件 hash 去重。Excel/CSV 另有生成列 `workbook_source_key`，只对原文件名做大小写与首尾空白归一，用于保守界定“同源工作簿”。

## `import_items`

私有候选记录。每项保存任务外键、目标类型、URL/PDF 页码/Excel 工作表与原始行、原始行 hash、原始数据、提取文本、结构化结果、管理员可编辑副本、证据、置信度、warnings、模型/响应/提示版本、审核状态和正式记录的类型安全外键。

Excel 的 `raw_row_hash` 使用键排序后的 JSON 计算 SHA-256，保留字符串空白，并严格区分 `NULL` 与数值 `0`。处理同源更新版时，仅在目标类型、sheet、原始行位置与原始行 JSON 都相同，且历史项仍为 `ai_draft`、`pending_review` 或 `approved` 时跳过；`rejected` 和 `import_failed` 不会永久屏蔽重新导入。历史 Job/Item ID、跳过行和提示写入 `input_metadata.excel_row_deduplication`。数据库还以 JSONB 相等做碰撞安全及旧 hash 兼容检查，不建立跨工作簿的全局唯一约束。

`ai_result` 保留首次结构化结果（URL/PDF 为 AI 严格输出，Excel 为已确认映射后的确定性结果），管理员修改写入 `draft_data`。批准必须调用 `approve_import_item(...)`：数据库事务校验管理员、地区、必填字段、状态枚举、数值/单位以及 PDF/Excel 证据位置，然后创建 `pending_review` Signal 或 `is_published = false` Metric，并回写 `approved_record_id`。重复批准幂等，不能自动发布。

## 私有 Storage

bucket `grid-ledger-imports` 为 private。对象路径为 `{auth.uid()}/{import_job_id}/{随机文件名}`；只有管理员可插入和签名读取，匿名用户没有对象策略。应用签名链接有效期短，并以下载方式提供原文件。

## RLS 与权限

- `anon` 和普通 `authenticated` 只能读取地区、`review_status = 'published'` 且已有 `published_at` 的 Signal，以及 `is_published = true` 的市场指标。
- 草稿、待审、驳回 Signal 不可通过 anon/普通登录身份读取。
- `import_jobs`、`import_items` 和 `grid-ledger-imports` 对匿名及普通登录用户均不可读写；只有管理员可访问。
- 管理员读写权限只认 JWT `app_metadata.role = 'admin'`；不读取用户可自行修改的 `user_metadata`。
- `anon` 对 Signal 仅有公开列权限，不可直接读取 `reviewer_id` 或 `created_by`；Next Viewer API 同样使用显式 DTO 白名单。
- `anon` 和普通 `authenticated` 对 BESS 项目事件只有公开业务列权限，不能读取 `source_batch`、`source_row_hash` 或 `raw`；候选人必须隶属于已发布父事件。
- seed 不创建 Auth 用户或存储明文密码。管理员账号应在部署时由受信任的服务端流程创建，并将角色写入 `app_metadata`。
