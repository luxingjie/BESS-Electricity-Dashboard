# Grid Ledger MVP 部署

推荐：Supabase Cloud 托管 PostgreSQL/Auth，Vercel 托管 Next.js。

## 1. 创建并初始化 Supabase

1. 创建 Supabase 项目。
2. 安装依赖并登录 CLI：

   ```bash
   npm install
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push --dry-run
   npx supabase db push --include-seed
   ```

`--include-seed` 仅用于本次全新 MVP/Demo 环境，以载入任务指定地区和显著标记的 Demo 夹具。已有真实数据的环境不要重复把 seed 当作生产数据导入；迁移本身使用 `npx supabase db push`。

大洲类型与目录数据故意拆为两个迁移：必须先提交 `202607220003_add_continent_region_type.sql`，再执行 `202607220004_global_region_directory.sql`。不要把两者合并进同一事务；后一个迁移会把中国等既有国家安全重挂到对应大洲，不修改 Signal 或 Market Metric 的 `region_id`。

3. 在 Supabase Dashboard → Authentication 创建管理员邮箱密码用户。
4. 在 SQL Editor 将其可信 `app_metadata` 设为管理员：

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
     || '{"role":"admin"}'::jsonb
   where email = 'admin@example.com';
   ```

5. 生产项目建议关闭公开自助注册；本产品没有注册页面，普通认证用户也会被 RLS 拒绝管理读写。

## 2. 部署 Next.js 到 Vercel

1. 将目录纳入 Git 仓库并推送到受控代码托管平台。
2. 在 Vercel 导入项目，Framework Preset 选择 Next.js。
3. 为 Production/Preview 分别配置：

   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   OPENAI_API_KEY
   CRON_SECRET
   SUPABASE_SERVICE_ROLE_KEY
   # optional; defaults to gpt-5.6-terra
   OPENAI_MODEL
   ```

   兼容旧项目时可用 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 代替 publishable key。`OPENAI_API_KEY`、`CRON_SECRET`、`SUPABASE_SERVICE_ROLE_KEY` 只能作为服务端变量，不能添加 `NEXT_PUBLIC_` 前缀。`CRON_SECRET` 用于 Vercel Cron 调用 `/api/cron/policy-ingest` 的 Bearer 鉴权；`SUPABASE_SERVICE_ROLE_KEY` 仅供该 cron 写入 ingest 表，不要暴露给浏览器。

4. 在 Supabase Storage 确认迁移创建的 `grid-ledger-imports` bucket 为 private。对象读取与写入均受管理员 RLS 约束；不要改成 public。

5. Build Command 使用 `npm run build`；Start Command 在非 Vercel Node 平台使用 `npm run start`。
6. 部署后在 Supabase Auth URL 配置中加入正式站点 URL。

## 3. 上线前检查

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

本地发布前还应按 README 的环境变量命令运行 `npm run test:e2e:http`，用真实 Supabase Auth、RLS、Next API 和页面完成无 Playwright 的端到端验证。

手工烟测：

1. 未登录访问 `/admin`，应跳转 `/admin/login`。
2. 登录管理员，新建山东 Signal 并保存草稿。
3. 从公开首页、山东页及 `/api/public/signals/:id` 均确认草稿不可见。
4. 填写人工确认信息并发布。
5. 山东页可见该记录，详情可打开原文链接。
6. 新增一个空值市场指标，公开页显示 `—` 而不是 `0`。
7. 在“数据导入”上传小型文本 PDF 和 XLSX/CSV，确认私有文件可预览、AI 草稿不会进入公开 API，批准后只创建未发布正式草稿。

## 4. 其他 Node 平台

任何支持 Node.js 20.18.1+ 的平台均可使用标准 Next.js Node server：

```bash
npm ci
npm run build
npm run start
```

仍需配置上述两个 Supabase 环境变量，并先将 SQL migration 应用到目标 Supabase 项目。
