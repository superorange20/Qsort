# Qsort 云端同步配置（Supabase）

当前考试页仍保留浏览器本地自动保存；完成以下一次性配置后，邮箱账号可启用跨设备同步。

## 1. 创建 Supabase 项目

1. 登录 https://supabase.com/dashboard
2. 创建一个新项目，设置项目名称和数据库密码。
3. 等待项目初始化完成。

## 2. 建立数据库表及权限

1. 打开项目的 **SQL Editor**。
2. 打开本目录的 `supabase/schema.sql`，复制全部内容。
3. 在 SQL Editor 中执行。
4. 确认生成 `exam_states` 和 `exam_history` 两张表。

SQL 已启用 Row Level Security，并按 `auth.uid()` 限制用户只能访问自己的答题数据。不要关闭 RLS。

## 3. 配置邮箱登录

1. 打开 **Authentication → Providers → Email**，确保 Email provider 已启用。
2. 如启用了邮箱验证，注册后需要先点击验证邮件，再返回考试页面登录。
3. 打开 **Authentication → URL Configuration**，把考试网站的实际网址设置为 Site URL，并按部署地址添加 Redirect URLs。

## 4. 配置前端公开参数

1. 打开 **Project Settings → API**（部分界面显示为 API Keys）。
2. 复制 Project URL。
3. 复制 publishable key（或旧版 anon/public key）。
4. 编辑 `mso-exam/supabase-config.js`：
   - `YOUR_SUPABASE_PROJECT_URL` 替换为 Project URL；
   - `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` 替换为 publishable/anon key。
5. 保存并提交到 GitHub。

**安全要求：**浏览器代码中只能放 publishable/anon key，并且必须保持 RLS 开启。绝不能放 service_role/secret key、数据库密码或个人访问令牌。

## 5. 首次迁移与跨设备使用

- 第一次登录时，当前浏览器里已有的六套本地答题状态会迁移到云端。
- 已交卷的本地成绩会作为一条“历史数据迁移”记录写入考试历史。
- 后续每次选择答案都会自动同步；交卷时会额外保存一条历史成绩。
- 在另一台设备打开同一考试网址，使用同一个邮箱账号登录即可下载云端进度和历史成绩。
- 如果切换账号，系统不会把上一个账号的本地答题数据上传给新账号。

## 数据范围

- `exam_states`：每套试卷当前进度及当前成绩状态（每个用户、每套试卷一条）。
- `exam_history`：每次交卷的历史成绩、是否合格、各单元结果及答案快照。

历史成绩页面目前展示最近 50 次交卷记录。浏览器离线时仍可继续本地作答；重新联网后再次操作会继续同步。若需要更强的离线队列或管理员后台，需另行开发。
