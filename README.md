# 义川先森 · 个人网站

> 纯 HTML / CSS / JavaScript 与 **Cloudflare Pages Functions** 实现的个人网站。零前端框架、零 npm 依赖、零构建步骤;**项目根目录即静态资源目录**。

[![Stack](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=fff)](#)
[![Stack](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=fff)](#)
[![Stack](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)](#)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages_Functions-f38020?logo=cloudflare&logoColor=fff)](#)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-D1-f38020?logo=cloudflare&logoColor=fff)](#)

---

## 目录

- [1. 特性一览](#1-特性一览)
- [2. 目录结构](#2-目录结构)
- [3. 快速开始(3 步跑起来)](#3-快速开始3-步跑起来)
- [4. 部署与运行指南](#4-部署与运行指南)
  - [4.1 本地开发预览](#41-本地开发预览)
  - [4.2 部署到 Cloudflare Pages](#42-部署到-cloudflare-pages)
  - [4.3 运行时配置总表](#43-运行时配置总表)
  - [4.4 FAQ(排障快速定位)](#44-faq排障快速定位)
- [5. 数据库与迁移](#5-数据库与迁移)
  - [5.1 方言中立约定](#51-方言中立约定)
  - [5.2 Cloudflare D1(默认部署)](#52-cloudflare-d1默认部署)
  - [5.3 迁移到自建 MySQL / HTTP 网关](#53-迁移到自建-mysql--http-网关)
  - [5.4 SQL 方言中立编码规范(面向贡献者)](#54-sql-方言中立编码规范面向贡献者)
- [6. API 参考](#6-api-参考)
  - [6.1 通用约定(CORS / 鉴权 / 响应)](#61-通用约定cors--鉴权--响应)
  - [6.2 路由速查表](#62-路由速查表)
  - [6.3 访问计数 `/api/count`](#63-访问计数-apicount)
  - [6.4 留言板 `/api/guestbook`](#64-留言板-apiguestbook)
  - [6.5 友情链接 `/api/friends`](#65-友情链接-apifriends)
  - [6.6 分类 `/api/categories`](#66-分类-apicategories)
  - [6.7 文章 `/api/posts`](#67-文章-apiposts)
  - [6.8 资源 `/api/resources`](#68-资源-apiresources)
  - [6.9 图床 `/api/upload`](#69-图床-apiupload)
  - [6.10 健康探针 `/api/health`](#610-健康探针-apihealth)
- [7. 个性化替换清单](#7-个性化替换清单)
- [8. 技术设计约定](#8-技术设计约定)
- [9. License](#9-license)

---

## 1. 特性一览

| 模块 | 前端页面 | 管理端(CRUD) | 数据 |
| --- | --- | :---: | --- |
| 首页长叙事 | `index.html` | — | 静态 + KV 访问计数 |
| 关于(技能 / 时间线 / 联系方式) | `about.html` | — | 静态(后续接入数据库) |
| 项目展示 | `projects.html` | — | 静态(后续接入数据库) |
| 文章列表 | `articles.html` | — | D1 `posts` 表(Markdown) |
| 文章详情 | `article.html` | — | Markdown 渲染 + `@[bilibili]` 短码内嵌 B 站播放器 |
| 资源(分享文件) | `resources.html` | ✅ | D1 `resources` 表(外链或 R2) |
| 留言板(含回复线程) | `guestbook.html` | ✅ | D1 `guestbook` 表 |
| 友情链接 | `friends.html` | ✅ | D1 `friends` 表(含"友链穿越"动画) |
| 管理面板 | `yichuan.html` | ✅ | 密码登录 · 文章/资源/图床/分类/友链/留言 6 个 Tab · Markdown 编辑器 + 拖拽上传 |

扩展能力:
- 数据访问层已做 **D1 / MySQL 驱动抽象**(`functions/_lib/db.js`),后续迁移到服务器 MySQL 只需改一个环境变量 + 填网关地址
- 存储层已做 **R2 / 外链降级抽象**(`functions/_lib/storage.js`),不绑定 R2 时图床/资源仅存外链
- 亮 / 暗主题自动跟随 `prefers-color-scheme`,同时允许手动切换
- 响应式断点 768px(平板)与 480px(手机)

---

## 2. 目录结构

```text
Yichuan521/
├── index.html              首页(Launch Hero / 故事叙事 / 活动热力图 / 社区卡)
├── about.html              关于页(QQ 头像 API / 技能组 / 时间线 / 联系方式)
├── projects.html           项目页(搜索 / 分组筛选 / 项目卡片)
├── articles.html           文章列表(搜索 / 分类筛选 / 归档切换)
├── article.html            文章详情(marked.js + DOMPurify + B 站 iframe)
├── resources.html          资源页(分享文件 / 搜索 / 分类筛选 / 归档切换)
├── guestbook.html          留言板(发布 / 回复线程 / 字数限制)
├── friends.html            友链(搜索 + 友链穿越动画 + 申请说明)
├── yichuan.html            管理面板(6 Tab · Markdown 编辑器 + 预览 + 拖拽上传)
├── _routes.json            Pages Functions 路由白名单(仅放行 /api/*)
│
├── assets/
│   ├── css/style.css       全站样式(CSS 设计 Token · 亮/暗主题 · 响应式 · 动画)
│   └── js/main.js          全站脚本(留言 / 友链 / 文章列表 / 计数轮询 / 搜索 / 资源列表)
│
├── functions/
│   ├── _middleware.js      全局中间件(OPTIONS 预检 + CORS 头 + 访问日志)
│   ├── _lib/               适配器层(业务代码只 import 这一层,驱动切换零成本)
│   │   ├── http.js         CORS / json() / error() / ok()
│   │   ├── auth.js         X-Admin-Password 鉴权 + withAuth() 包装器
│   │   ├── db.js           createDb() → D1 驱动 / MySQL 驱动(接口已锁)
│   │   └── storage.js      createStorage() → R2 驱动 / 外链降级
│   └── api/                路由与业务(按文件名自动映射)
│       ├── count.js        访问计数(KV)
│       ├── guestbook.js    留言板 CRUD + 回复线程聚合
│       ├── friends.js      友链 CRUD
│       ├── categories.js   分类 CRUD(post / resource 共用)
│       ├── posts.js        文章 CRUD + slug 自动生成 + 摘要截取
│       ├── resources.js    资源 CRUD + 下载计数
│       ├── upload.js       图床上传(multipart) + 外链登记 + 列表/删除(走 R2)
│       └── health.js       db 四方法探针(部署排障)
│
└── schema/
    ├── d1.sql              Cloudflare D1 建表 DDL(生产必跑)
    └── mysql.sql           MySQL 建表 DDL(迁移到服务器用)
```

---

## 3. 快速开始(3 步跑起来)

### ① 本地看静态页面

直接浏览器双击 `index.html`,样式 / 脚本 / 主题切换都能正常工作。留言 / 友链 / 文章 / 计数等**动态接口**需要 KV / D1,走第 ② 步。

### ② Wrangler 本地模拟(含真接口)

```bash
# 1. 安装官方 CLI
npm install -g wrangler

# 2. 启动本地 Pages 服务器(PowerShell 用户请合并为单行)
npx wrangler@latest pages dev . \
  --kv KV_COUNT \
  --d1 DB=yichuan-dev \
  --var ADMIN_PASSWORD:your-dev-password

# 3. 本地 D1 建表
npx wrangler@latest d1 execute yichuan-dev --local --file=schema/d1.sql
```

访问:
- 首页:`http://localhost:8788/`
- 健康探针:`http://localhost:8788/api/health`(返回 `driver:d1` 四方法全 ok)
- 管理面板:`http://localhost:8788/yichuan.html` 密码 = `your-dev-password`

详细步骤见 [4.1 本地开发预览](#41-本地开发预览)。

### ③ 部署到 Cloudflare Pages(线上)

一句话流程:`推 GitHub → 创建 Pages 项目 → 创建 KV/D1/(R2)→ Bindings → Variables → Retry deployment → 验证`。完整步骤见 [4.2 部署到 Cloudflare Pages](#42-部署到-cloudflare-pages)。

---

## 4. 部署与运行指南

### 4.1 本地开发预览

#### 4.1.1 最简预览(仅静态页面)

留言 / 友链 / 文章 / 计数等动态接口需要 KV / D1,只有静态内容可直接双击 HTML 查看。

#### 4.1.2 Wrangler 本地模拟(含 KV / D1)

Wrangler 是 Cloudflare 官方 CLI,可以在本地用 SQLite 模拟 D1、用内存模拟 KV,接口行为与线上 1:1。

```bash
# 安装 Wrangler(一次即可)
npm install -g wrangler
# 若不希望全局安装,可每次用: npx wrangler@latest ...
```

```bash
npx wrangler@latest pages dev . \
  --kv KV_COUNT \
  --d1 DB=yichuan-dev \
  --var ADMIN_PASSWORD:your-dev-password
```

> Windows PowerShell 不支持 `\` 续行,请写成单行:
> `npx wrangler@latest pages dev . --kv KV_COUNT --d1 DB=yichuan-dev --var ADMIN_PASSWORD:your-dev-password`

启动成功后本地地址为 `http://localhost:8788`,接着在本地 D1 中建表:

```bash
npx wrangler@latest d1 execute yichuan-dev --local --file=schema/d1.sql
```

验证:

| 项目 | 地址 |
| --- | --- |
| 首页 | `http://localhost:8788/` |
| 健康探针 | `http://localhost:8788/api/health`(应返回 `driver: "d1"`,四个方法均为 `ok`) |
| 管理面板 | `http://localhost:8788/yichuan.html`,密码是 `your-dev-password` |

---

### 4.2 部署到 Cloudflare Pages

#### 4.2.1 推送仓库

将项目推送到 GitHub(或 GitLab)仓库,公开私有均可。

#### 4.2.2 创建 Pages 项目

Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。

**Build configuration**(此项目**无构建步骤**):

| 字段 | 值 | 说明 |
| --- | --- | --- |
| Framework preset | `None`(或"无框架") | 非 SPA / SSR 项目 |
| Build command | **留空** | 没有任何 npm / vite / build 命令 |
| Build output directory | **留空**(或填 `/`) | 项目根即静态输出目录 |
| Root directory | **留空**(单仓单项目) | |

点击 **Save and Deploy**,首次部署完成后获得 `<项目名>.pages.dev` 域名。

#### 4.2.3 创建 KV / D1 / R2 资源

在 **Workers & Pages** 左侧导航下分别创建:

**KV Namespace(访问计数,必选)**
- 创建位置:Workers & Pages → **KV** → **Create a namespace**
- 建议命名:`yichuan-count`(命名本身不关键,绑定变量名才关键)

**D1 Database(所有结构化数据,必选)**
- 创建位置:Workers & Pages → **D1 SQL database** → **Create database**
- 建议命名:`yichuan-db`
- 创建后进入该数据库 → **Console** → 粘贴完整执行 `schema/d1.sql`
- 执行结果应出现 6 张表:`guestbook` / `friends` / `categories` / `posts` / `resources` / `assets`

**R2 Bucket(文件上传,可选)**
- 创建位置:Workers & Pages → **R2** → **Create bucket**
- 建议命名:`yichuan-storage`
- 配置自定义域(CNAME)或使用 `r2.dev` 公共访问域,将基址写入 `R2_PUBLIC_BASE` 环境变量
- 不绑定则图床上传和资源页 R2 引用功能不可用(可仅登记外链)

#### 4.2.4 配置 Bindings

**Pages → 你的项目 → Settings → Bindings**,为 Production 环境添加:

| 变量名(区分大小写) | 类型 | 绑定到 | 必须 |
| --- | --- | --- | --- |
| `KV_COUNT` | KV namespace | `yichuan-count` | ✅ 是 |
| `DB` | D1 database | `yichuan-db` | ✅ 是 |
| `R2_BUCKET` | R2 bucket | `yichuan-storage`(不创建可跳过) | ⭕ 否 |

> Bindings **严格区分大小写**:必须精确写成 `DB`(大写)、`KV_COUNT`(大写+下划线),少一个字母或大小写错一个,所有读写接口都会 500。

#### 4.2.5 配置环境变量 / 密钥

同一页 **Settings → Variables and Secrets**:

| 变量名 | 类型 | 示例 / 说明 | 必须 |
| --- | --- | --- | --- |
| `ADMIN_PASSWORD` | Encrypt(加密) | 强密码,建议 ≥16 位,如 `K9#pQ2z$xT!vR7mW` | ✅ 是 |
| `R2_PUBLIC_BASE` | Plaintext | 留空或 R2 公开域名,例 `https://cdn.example.com`。**留空时图床上传的图片无法在文章/资源页直接显示**(URL 会是空串)。配置后 R2 引用才可直链访问。 | ⭕ 否 |
| `DB_DRIVER` | Plaintext | 默认 `d1`,不填即可;迁移 MySQL 时改为 `mysql` | ⭕ 否 |

> 🔒 `ADMIN_PASSWORD` **必须使用 Encrypt**。Plaintext 会明文出现在 Build Log 与 API trace 里。

#### 4.2.6 重新部署

Bindings 与 Variables / Secrets 的任何变更**不会**自动应用到已经部署好的版本,必须手动触发一次重新部署:

Pages 项目 → **Deployments** → 最新的 Deployment → **...**(更多)→ **Retry deployment**(或在 Git 上推一个空提交 `git commit --allow-empty -m "rebuild"; git push`)。

#### 4.2.7 健康检查与验证

部署完成后依次打开:

| URL | 预期结果 |
| --- | --- |
| `https://<项目>.pages.dev/` | 首页正常显示,亮 / 暗主题切换按钮可用 |
| `https://<项目>.pages.dev/api/health` | `{"driver":"d1","all":[{"v":1}],"first":1,"run":true,"batch":true,"error":null}` |
| `https://<项目>.pages.dev/api/count` | 返回 `{ total, today, today_uv }`(首次调用后值非空) |
| `https://<项目>.pages.dev/api/posts` | `{ "posts": [], ... }`(空数组也表示连通正常) |
| `https://<项目>.pages.dev/yichuan.html` | 输入 `ADMIN_PASSWORD` → 顶部 6 个统计数字不是破折号 |

若任何一步与预期不符,参考 [4.4 FAQ](#44-faq排障快速定位)。

---

### 4.3 运行时配置总表

两张表合起来就是"迁一份新环境时,需要填哪些字段"的完整清单。

#### 4.3.1 Bindings(Cloudflare 服务绑定)

| 变量名 | 服务类型 | 作用 | 代码中的用法 |
| --- | --- | --- | --- |
| `KV_COUNT` | KV Namespace | 访问计数(总访问 / 今日 PV / UV IP 去重) | `env.KV_COUNT.getWithMetadata(...)` / `put(...)` |
| `DB` | D1 Database | 全部结构化数据(留言 / 友链 / 分类 / 文章 / 资源 / 图床) | `createDb(env) → env.DB.prepare(sql).bind(params)` |
| `R2_BUCKET` | R2 Bucket(可选) | 文件上传(图床真上传) | `createStorage(env) → bucket.put(key, body)` |

#### 4.3.2 Variables / Secrets(环境变量与密钥)

| 变量名 | 加密? | 默认值 | 作用 |
| --- | --- | --- | --- |
| `ADMIN_PASSWORD` | ✅ Encrypt | — | 管理员密码。所有写操作(POST / PUT / DELETE)的鉴权凭证 |
| `DB_DRIVER` | 否 | `d1` | 数据库驱动标识。`d1`=Cloudflare D1;迁移时改成 `mysql` |
| `R2_PUBLIC_BASE` | 否 | 空 | R2 下载直链的公开基址。留空则前端无法 `<img src>` 直链访问,需要补该变量 |
| `MYSQL_HTTP_URL`(可选) | ✅ Encrypt | — | MySQL 迁移后:自建 HTTP 网关的 URL |
| `MYSQL_TOKEN`(可选) | ✅ Encrypt | — | MySQL 迁移后:HTTP 网关鉴权 Token |

---

### 4.4 FAQ(排障快速定位)

**Q1: 部署后所有 `/api/*` 都是 500?**
A:99% 是 Bindings 名字对不上。检查 Pages → Settings → Bindings 里 KV / D1 的**变量名**是否严格为 `KV_COUNT` / `DB`(大小写、下划线一字不差),然后 **Retry deployment**。

**Q2: `/api/posts` 返回 `driver not implemented`?**
A:`DB_DRIVER` 设错。在 Variables 里删除该变量(回退默认 `d1`),或把值改成 `d1`。MySQL 驱动接口已锁但未实现,直接设只会报错。

**Q3: 管理面板输完密码没反应,一直转圈?**
A: 浏览器 F12 → Network 看鉴权请求(`DELETE /api/guestbook?id=999999`):
- **401** → 密码不对,或 `ADMIN_PASSWORD` 变量值与输入不一致
- **500** → 服务端未配置 `ADMIN_PASSWORD`(变量名错 / 未加密变量 / 未重新部署)
- **CORS 报错** → `_middleware.js` / `_routes.json` 未部署(应该包含 `/api/*`)

**Q4: 改动环境变量 / Bindings 后还是旧的行为?**
A: Pages 行为:Bindings 与 Variables 的变更必须触发一次新的 Build 才会注入。**Retry deployment** 或 Git push 一次。

**Q5: 要把 `*.pages.dev` 改成自己的域名?**
A: Pages 项目 → **Custom domains** → **Set up a custom domain**。按 Cloudflare 指引解析 CNAME(若是已接入 Cloudflare 的域则自动解析),一般 2~10 分钟生效。API / Bindings / 变量无需任何改动。

**Q6: 后台图床上传报错"图床上传未启用"?**
A:`R2_BUCKET` 没绑定。Pages → Settings → Bindings → 新增 R2 绑定,变量名**必须严格为 `R2_BUCKET`**。若希望图片能直接 `<img src=...>`,还需配置 `R2_PUBLIC_BASE`(填 R2 公开访问域)。配置完务必重新部署。

**Q7: 上传图片在管理面板显示问号 / 不显示?**
A: 是 `R2_PUBLIC_BASE` 未配置。`assets` 表的 `url` 字段会留空。补上该环境变量后旧素材 URL 不会自动回填,需要重新上传,或在图床 Tab 用"登记外链"重写。

**Q8: 文章里的 B 站视频不显示?**
A: 短码必须是 `@[bilibili](BV1xx)` 或带完整 bilibili.com 链接,BVID 必须以 `BV` 开头。详情页和后台预览都会自动替换为官方 iframe。

---

## 5. 数据库与迁移

### 5.1 方言中立约定

默认部署在 Cloudflare D1;通过 `functions/_lib/db.js` 的驱动抽象,无需修改业务代码即可切换到 MySQL。

为了驱动切换零成本,所有业务 SQL 遵循以下约定:

| 维度 | 规定 | 原因 |
| --- | --- | --- |
| 占位符 | 统一 `?` | D1、MySQL、SQLite(本地 Wrangler)都支持 |
| 时间戳 | JS 端 `Math.floor(Date.now() / 1000)` 作为整数传入 | 避免 `unixepoch()`(D1)与 `UNIX_TIMESTAMP()`(MySQL)不一致 |
| 列名 | 避开保留字;需保留字时只在 DDL 里带引号出现(`"desc"` / `` `desc` ``) | 保留字冲突只出现在 DDL 层,运行时用 `?` 绑定参数绕过 |
| 批量 | 不依赖 `RETURNING` / `last_insert_id()` 跨语句传播;必要时分两次调用 | D1 batch 无法在同 batch 取中间 insert id |

方言差异**只出现在 `schema/*.sql` 两份 DDL**(D1 一份、MySQL 一份),业务代码不出现任何方言特有函数。

---

### 5.2 Cloudflare D1(默认部署)

#### 5.2.1 全量建表 DDL(新环境必跑)

进入 Cloudflare Dashboard → **D1 SQL databases** → 选中 `yichuan-db` → **Console** → 粘贴完整执行 `schema/d1.sql`(内容见文件):

表清单:
1. `guestbook`(留言 + 回复线程)
2. `friends`(友链)
3. `categories`(分类,type=`post`/`resource` 共用)+ `idx_categories_type` 索引
4. `posts`(文章,含 slug、tags、status、archived、views)+ 4 个索引
5. `resources`(分享文件,区分外链与 R2)
6. `assets`(图床素材,key 唯一索引,含 width/height 图片元信息)+ `idx_assets_uploaded` + `uq_assets_key`

执行成功后可跑 `PRAGMA table_info(guestbook);` 验证列是否存在。

#### 5.2.2 从早期版本升级(只有 guestbook / friends)

早期部署的 `guestbook` 表缺 `email` 与 `reply_to`,在 D1 Console 执行:

```sql
ALTER TABLE guestbook ADD COLUMN email TEXT;
ALTER TABLE guestbook ADD COLUMN reply_to INTEGER;
```

然后复制 `schema/d1.sql` 中 `categories` / `posts` / `resources` / `assets` 四张表的 `CREATE TABLE IF NOT EXISTS` 部分执行即可(`IF NOT EXISTS` 保证不会重建已有的 `guestbook` / `friends`,旧数据不丢)。

#### 5.2.3 可选:插入测试数据

```sql
INSERT INTO friends (name, url, desc, avatar, time)
VALUES ('Cloudflare', 'https://www.cloudflare.com/', '构建更好的互联网。', 'https://www.cloudflare.com/favicon.ico', unixepoch());

INSERT INTO categories (name, slug, type, sort, time) VALUES
  ('前端笔记', 'frontend', 'post', 0, unixepoch()),
  ('学习资料', 'learn', 'resource', 0, unixepoch());
```

> 💡 D1 提供 `unixepoch()`,但业务代码统一用 JS 端生成时间戳,保证 D1 与 MySQL 行为一致。仅写测试数据可临时使用 `unixepoch()`。

#### 5.2.4 表结构速查

| 表 | 关键字段 | 用途 | 对应 API |
| --- | --- | --- | --- |
| `guestbook` | id, nickname, email, content, reply_to, time | 留言主表,回复自关联 | [6.4 留言板](#64-留言板-apiguestbook) |
| `friends` | id, name, url, desc, avatar, time | 友情链接 | [6.5 友情链接](#65-友情链接-apifriends) |
| `categories` | id, name, slug, type(post/resource), sort, time | 分类(post 给文章 / resource 给资源) | [6.6 分类](#66-分类-apicategories) |
| `posts` | id, title, slug, content, excerpt, tags, category_id, status, archived, views, time, update_time | 文章(Markdown 原文存 `content`) | [6.7 文章](#67-文章-apiposts) |
| `resources` | id, name, description, url, file_key, size, file_type, category_id, source, archived, downloads, time | 分享文件(外链 url 或 R2 key) | [6.8 资源](#68-资源-apiresources) |
| `assets` | id, key, url, filename, size, mime, width, height, source, uploaded_at | 图床统一素材(文章/资源都可引用其 URL) | [6.9 图床](#69-图床-apiupload) |

---

### 5.3 迁移到自建 MySQL / HTTP 网关

#### 5.3.1 背景:为什么不能直接用 mysql2 包

Cloudflare Workers / Pages Functions 运行时是基于 V8 的隔离沙箱,**禁止原生 TCP socket 连接(net/tls 模块不存在)** 与原生 `.node` 扩展加载。因此 `mysql2` / `pg` 等基于 TCP 的驱动不能在 Pages 直接用,必须走 HTTP 通道:Pages 发 HTTPS 请求 → 外部网关翻译成 SQL → 结果 JSON 返回。

#### 5.3.2 三种 HTTP 通道方案

| 方案 | 适合场景 | 配置方式 |
| --- | --- | --- |
| A. PlanetScale `@planetscale/database` fetch 模式 | 已在用 PlanetScale | import connect,配置 PLANETSCALE_HOST/USERNAME/PASSWORD env 变量 |
| B. Cloudflare Hyperdrive | MySQL 实例有公网 IP 能被 Hyperdrive 连接 | Dashboard 创建 Hyperdrive 后 Bindings,`env.HYPERDRIVE`(Pages 支持待确认) |
| C. 自建 HTTP 网关(推荐) | 完全掌控 / 迁到内网 MySQL | 在能 TCP 连 MySQL 的主机部署 `/execute` JSON 微服务,Pages 用 `fetch` 调用 |

无论选哪一种,都在 `functions/_lib/db.js` 的 `createMysqlDriver(env)` 里实现同构的 4 个方法,**业务文件零改动**。

#### 5.3.3 MySQL 建表 DDL

在自建 MySQL 服务器里执行 `schema/mysql.sql`(结构与 D1 DDL 对齐,方言差异:`AUTO_INCREMENT`、反引号保留字、`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)。

#### 5.3.4 实现 MySQL 驱动(functions/_lib/db.js)

对外返回的对象必须与 D1 驱动同构:

```js
{
  driver: 'mysql',
  async all(sql, params = [])   { return [ {...}, {...} ] },
  async first(sql, params = [], col) { return row | col | null },
  async run(sql, params = [])   { return { success: true, meta: {...}, lastRowId: Number } },
  async batch(stmts)            { return [ stmt1Result, ... ] }
}
```

**自建网关参考实现片段**(替换 db.js 的 `createMysqlDriver` 函数体):

```js
async function gatewayFetch(env, sql, params) {
  const resp = await fetch(env.MYSQL_HTTP_URL + '/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.MYSQL_TOKEN}` },
    body: JSON.stringify({ sql, params }),
  });
  if (!resp.ok) throw new Error(`Gateway ${resp.status}`);
  return resp.json();
}
function createMysqlDriver(env) {
  return {
    driver: 'mysql',
    async all(sql, params = []) {
      const r = await gatewayFetch(env, sql, params);
      return r.rows || [];
    },
    async first(sql, params = [], col) {
      const rows = await this.all(sql, params);
      const row = rows[0] || null;
      if (!row) return null;
      return col ? row[col] : row;
    },
    async run(sql, params = []) {
      const r = await gatewayFetch(env, sql, params);
      return { success: true, meta: r.meta || {}, lastRowId: r.insertId ? Number(r.insertId) : undefined };
    },
    async batch(stmts) {
      return Promise.all(stmts.map(s => this.run(s.sql, s.params || [])));
    },
  };
}
```

#### 5.3.5 切换驱动与数据迁移

1. 代码中实现好 `createMysqlDriver`,push 重新部署。
2. Pages → **Variables** 新增:`DB_DRIVER=mysql` / `MYSQL_HTTP_URL`(Encrypt) / `MYSQL_TOKEN`(Encrypt)。
3. **Retry deployment** 注入新变量。
4. 访问 `/api/health` 验证 `driver="mysql"` + 四方法全 ok。
5. D1 导出 CSV → MySQL Workbench / `LOAD DATA INFILE` / 自建脚本导入;主键 `id` 建议保留,避免文章 slug 与 id 映射错位。

---

### 5.4 SQL 方言中立编码规范(面向贡献者)

修改 `functions/api/*.js` 与新增 SQL 时,务必遵守:

1. **占位符只用 `?`**。禁止 `$1`、`:name` 等驱动特有语法。
2. **时间戳永远用 JS 生成**:`const now = Math.floor(Date.now()/1000)` 作为 bind 参数。禁止写 `UNIX_TIMESTAMP()` / `unixepoch()` / `NOW()`。
3. **列名不碰保留字**。`desc` 只在 DDL 里带引号出现,业务层统一存 `description`。
4. **批量语句不跨语句依赖 ID**。D1 batch 返回 last_row_id 但不能在后续语句里用,插入主表取 ID → 再插子表分两步走。
5. **新增表必须同时提交两份 DDL**:`schema/d1.sql` 与 `schema/mysql.sql` 各一份,字段/索引/注释对齐。
6. **索引命名统一**:`idx_<表名>_<列名>`,例 `idx_posts_slug`。

---

## 6. API 参考

### 6.1 通用约定(CORS / 鉴权 / 响应)

#### 6.1.1 前缀 / CORS / 编码

- **Base URL**:`https://<你的 Pages 域名>/api/...`
- **CORS**:全开,`Access-Control-Allow-Origin: *`
  - 允许方法:`GET, POST, PUT, DELETE, OPTIONS`
  - 允许 Header:`Content-Type, X-Admin-Password`
- **字符编码**:所有 JSON 均为 UTF-8
- **时间**:所有时间字段均为**秒级 Unix 时间戳**(整数),前端自行格式化

#### 6.1.2 鉴权

管理后台**写操作**(POST / PUT / DELETE)需要管理员身份。密码取值优先级(高→低):

| 优先级 | 位置 | 说明 | 推荐 |
| --- | --- | --- | --- |
| 1 | `X-Admin-Password` 请求头 | 不进 CF access log | ✅ 推荐 |
| 2 | `?password=xxx` query | 会出现在访问日志和 referer,仅兼容 | ❌ 废弃 |
| 3 | JSON body `password` 字段 | 早期接口保留,过渡期可用 | ⚠️ 仅兼容 |

> 管理面板已统一走 `X-Admin-Password` header。

#### 6.1.3 响应格式

所有响应都是 JSON,HTTP 状态码驱动:

| HTTP status | 含义 | 常见 body |
| --- | --- | --- |
| 200 | 成功 | `{ "posts":[...], "ok":true, ... }` |
| 400 | 参数错误 | `{ "error": "分类名称不能为空。" }` |
| 401 | 鉴权失败 | `{ "error": "管理员密码错误。" }` |
| 404 | 资源不存在 | `{ "error": "文章不存在。" }` |
| 500 | 服务端异常 | `{ "error": "..." }` |

出错时 body 一定有 `error` 字段,可直接作为 toast / alert 文案。

---

### 6.2 路由速查表

| 路由 | 方法 | 需鉴权 | 所属功能 |
| --- | --- | :---: | --- |
| `/api/count` | GET | 否 | 访问计数 |
| `/api/guestbook` | GET | 否 | 留言列表(含回复线程聚合) |
| `/api/guestbook` | POST | 否 | 发布留言 / 回复 |
| `/api/guestbook?id=N` | DELETE | ✅ | 删除留言(含子回复) |
| `/api/friends` | GET | 否 | 友链列表 |
| `/api/friends` | POST | ✅ | 新增友链 |
| `/api/friends` | PUT | ✅ | 编辑友链 |
| `/api/friends?id=N` | DELETE | ✅ | 删除友链 |
| `/api/categories` | GET | 否 | 分类列表(`?type=post\|resource`) |
| `/api/categories` | POST | ✅ | 新增分类 |
| `/api/categories` | PUT | ✅ | 编辑分类 |
| `/api/categories?id=N` | DELETE | ✅ | 删除分类 |
| `/api/posts` | GET | 否 | 文章列表(`?status &archived &category &q`) |
| `/api/posts?slug=xxx / ?id=N` | GET | 否 | 单篇详情(浏览量 +1) |
| `/api/posts` | POST | ✅ | 新建文章 |
| `/api/posts` | PUT | ✅ | 更新文章 |
| `/api/posts?id=N` | DELETE | ✅ | 删除文章 |
| `/api/resources` | GET | 否 | 资源列表(`?category &archived=0/1/all &q`) |
| `/api/resources?id=N` | GET | 否 | 单条详情(下载量 +1) |
| `/api/resources` | POST | ✅ | 新建资源(外链 / R2 引用) |
| `/api/resources` | PUT | ✅ | 更新资源 |
| `/api/resources?id=N` | DELETE | ✅ | 删除资源(R2 引用时同步删对象) |
| `/api/upload` | GET | 否 | 图床素材列表(`?mime=image/doc &q=`) |
| `/api/upload?id=N` | GET | 否 | 单条素材元数据 |
| `/api/upload` | POST | ✅ | multipart 上传到 R2 |
| `/api/upload` | PUT | ✅ | 登记外链素材(无文件) |
| `/api/upload?id=N` | DELETE | ✅ | 删除素材(R2 同步删对象) |
| `/api/health` | GET | 否 | db 四方法探针 |

---

### 6.3 访问计数 `/api/count`

**GET `/api/count`**

| Query | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `raw` | 1/0 | 0 | `1`=只读刷新(前端 30 秒轮询),不增加计数 |

响应:

```json
{ "total": 1234, "today": 56, "today_uv": 32 }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| total | number | 站点累计 PV |
| today | number | 今日 PV |
| today_uv | number | 今日 UV(IP 去重,当日 IP 列表上限 2000 条防爆) |

调用:

```bash
curl "https://<站点>.pages.dev/api/count"          # 真实访问(计数 +1)
curl "https://<站点>.pages.dev/api/count?raw=1"    # 只读刷新(前端轮询用)
```

---

### 6.4 留言板 `/api/guestbook`

#### 6.4.1 GET 列表(含回复线程)

响应:

```json
{
  "messages": [
    {
      "id": 42, "nickname": "张三", "email": "zhangsan@example.com",
      "content": "你好呀!", "reply_to": null, "time": 1723710000,
      "replies": [
        { "id": 43, "nickname": "博主", "content": "谢谢!", "reply_to": 42, "time": 1723710100 }
      ]
    }
  ]
}
```

顶层列表仅含**主留言**,回复聚合在 `replies`;顺序 `time` 倒序。

#### 6.4.2 POST 发布留言或回复(无需鉴权)

| 请求字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| nickname | string | ✅ | ≤24 字符 |
| email | string | ❌ | ≤60 字符(用于回复通知) |
| content | string | ✅ | ≤300 字符 |
| reply_to | number | ❌ | 被回复的主留言 id,空=新主留言 |

成功: `{ "ok": true, "id": 44, "time": 1723710200 }`

#### 6.4.3 DELETE 删除(管理员)

`DELETE /api/guestbook?id=42`。若是主留言 id,子回复一并删除。Header `X-Admin-Password: $ADMIN_PASSWORD`。

---

### 6.5 友情链接 `/api/friends`

#### 6.5.1 GET 友链列表 → `{ friends:[...] }`,`time` 倒序。

#### 6.5.2 POST 新增(管理员)

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| name | string | ✅ | ≤60 字符 |
| url | string | ✅ | 站点 URL(建议 https://) |
| desc | string | ✅ | 简介 ≤160 字符 |
| avatar | string | ❌ | 头像 URL,留空默认 Google favicon |

#### 6.5.3 PUT 编辑(管理员)

请求体同 POST,必须带 `id`。

#### 6.5.4 DELETE 删除

`DELETE /api/friends?id=5`

---

### 6.6 分类 `/api/categories`

文章 / 资源共用一张 categories 表,`type` 字段区分。

#### 6.6.1 GET 分类列表

| Query | 默认 | 可选值 |
| --- | --- | --- |
| `type` | `post` | `post` / `resource` |

响应:

```json
{ "categories": [
  { "id":2, "name":"前端笔记", "slug":"frontend", "type":"post", "sort":0, "time":... }
] }
```

顺序:`sort` 升序 → `id` 升序。

#### 6.6.2 POST 新增(管理员)

| 字段 | 必填 | 默认 | 说明 |
| --- | :---: | --- | --- |
| name | ✅ | — | ≤60 字符 |
| type | ❌ | `post` | `post` / `resource` |
| slug | ❌ | null | URL 友好标识,≤80 字符 |
| sort | ❌ | 0 | 排序数字,越小越靠前 |

#### 6.6.3 PUT 编辑(必须带 id)

#### 6.6.4 DELETE 删除

`DELETE /api/categories?id=2`。⚠️ 删除后对应文章 / 资源的 `category_id` 会被置空(内容本身不删),前端显示为"未分类"。

---

### 6.7 文章 `/api/posts`

Markdown 原文存 `content` 字段,渲染由前端做(marked.js + DOMPurify + B 站短码 `@[bilibili](BV1xx)` 替换)。

#### 6.7.1 GET 列表

| Query | 默认 | 说明 |
| --- | --- | --- |
| `status` | `published` | `draft` / `published` / `all`(管理端) |
| `archived` | `0` | `0`=未归档 / `1`=归档 / `all`=忽略 |
| `category` | — | 指定 `category_id` |
| `q` | — | 匹配 title + excerpt 关键词搜索 |

列表响应**不包含 `content` 字段**(仅标题/摘要)。

#### 6.7.2 GET 单篇详情(二选一 Query)

`?slug=xxx` 或 `?id=N`。响应含 `content`,每次访问 `views` 自动 +1。

#### 6.7.3 POST 新建

| 字段 | 必填 | 默认 | 说明 |
| --- | :---: | --- | --- |
| title | ✅ | — | ≤200 字符 |
| content | ✅ | — | Markdown 原文 |
| slug | ❌ | 自动生成 | 留空:英文转 kebab-case,中文兜底 `p{timestamp}` |
| excerpt | ❌ | 自动截取 | 留空时从 content 截纯文本前 120 字符 |
| tags | ❌ | null | 逗号分隔字符串(`"Vue, 前端"`) |
| category_id | ❌ | null | |
| status | ❌ | `draft` | `draft` / `published` |
| archived | ❌ | 0 | 0 / 1 |

成功: `{ "ok": true, "id": 10, "slug": "p1723710200" }`

#### 6.7.4 PUT 更新(必须带 `id`,未传字段保持不变;`update_time` 自动刷新)

#### 6.7.5 DELETE 删除

`DELETE /api/posts?id=10`

---

### 6.8 资源 `/api/resources`

资源是"分享文件"的抽象:外链 or 图床引用(R2)。`resources.html` 从这张表渲染卡片。

#### 6.8.1 GET 列表

| Query | 默认 | 说明 |
| --- | --- | --- |
| `archived` | `0` | 0/1/all |
| `category` | — | 指定 `category_id` |
| `q` | — | 匹配 name + description |

#### 6.8.2 GET 单条详情

`GET /api/resources?id=1`,响应含 `file_key`,`downloads` 自动 +1。

#### 6.8.3 POST 新建(管理员)

| 字段 | 必填 | 默认 | 说明 |
| --- | :---: | --- | --- |
| name | ✅ | — | ≤120 字符 |
| description | ❌ | — | ≤500 字符 |
| url | ✅ | — | 外链或图床 URL |
| source | ❌ | `external` | `external` / `r2` |
| file_key | ❌ | null | R2 key(source=r2 时填) |
| size / file_type | ❌ | null | 字节数 / MIME |
| category_id | ❌ | null | 关联 categories(type=resource) |
| archived | ❌ | 0 | 0/1 |

#### 6.8.4 PUT 更新(必须带 id)

#### 6.8.5 DELETE 删除

`DELETE /api/resources?id=1`。⚠️ `source=r2` 会尝试从 R2 删除对象(失败不阻断 DB 删除)。

---

### 6.9 图床 `/api/upload`

所有上传的图片/文档/压缩包统一存 `assets` 表,文章/资源都可引用其 URL。无 R2 绑定时只能用 PUT 登记外链模式。

#### 6.9.1 GET 列表

| Query | 说明 |
| --- | --- |
| `mime` | `image`=仅图片 / `doc`=仅非图片 |
| `q` | 按 filename 模糊搜索 |

#### 6.9.2 POST 上传(multipart,管理员)

- 请求格式:`multipart/form-data`,字段名 `file`
- 约束:单文件 ≤ 25 MB
- MIME 白名单:
  - 图片:`image/jpeg, png, gif, webp, svg+xml, bmp, avif`
  - 文档:`application/pdf, zip, Office 系列, text/plain, text/markdown, application/json`

curl 示例:

```bash
curl -X POST "https://<站点>.pages.dev/api/upload" \
  -H "X-Admin-Password: $ADMIN_PASSWORD" \
  -F "file=@/path/to/cover.png"
```

成功响应返回完整 asset 元数据(含自动解析的图片宽高 PNG/JPEG/GIF/WebP):

```json
{ "ok": true, "asset": { "key":"uploads/2026/.../xxx.png", "url":"https://...", "filename":"cover.png",
                         "size":234567, "mime":"image/png", "width":1280, "height":720,
                         "source":"r2", "uploaded_at":1723710200 } }
```

#### 6.9.3 PUT 登记外链(管理员,不发文件)

不上传文件,只写一条记录,便于后续在图床列表中找到。请求体:

```json
{ "url": "https://example.com/cover.png", "filename": "cover.png",
  "mime": "image/png", "width": 1280, "height": 720, "size": 234567 }
```

#### 6.9.4 DELETE 删除

`DELETE /api/upload?id=1`。⚠️ `source=r2` 时同步从 R2 删除对象。

---

### 6.10 健康探针 `/api/health`

部署/迁移后快速验证 db 驱动 4 核心方法连通性,**无需鉴权**。

响应:

```json
{
  "driver": "d1",
  "all": [ { "v": 1 } ],
  "first": 1,
  "run": true,
  "batch": true,
  "error": null
}
```

排障顺序:
1. `error !== null` → 直接读报错定位 Bindings 或驱动
2. 四方法有任一 null / false → `db.js` 对应方法 bug
3. 四方法全 ok 但 API 实际跑不通 → 查业务层或 schema 未执行

---

## 7. 个性化替换清单

部署前在所有 HTML 中搜索替换这些占位:

| 占位 | 替换为 | 出现位置 |
| --- | --- | --- |
| `义川先森` | 你的名字 / 站点品牌 | `<title>`、footer、各页标题 |
| `YUAN·LAB` | 你的 Logo 文字(导航栏 brand) | 所有 HTML 的 `.brand` 元素 |
| `3459994583` | 你的 QQ 号 | `about.html` QQ 头像 API 链接: `https://q.qlogo.cn/g?b=qq&nk=QQ号&s=100` |
| `你的GitHub用户名` | 真实 GitHub 用户名 | `projects.html` 项目卡「源码 ↗」链接 |
| `your@email.com` | 真实邮箱 | `about.html` 联系方式卡片 |

> 后续版本计划将首页精选、关于页技能/时间线/联系方式、项目卡片全部迁入 D1,由管理面板维护,届时替换表会大幅缩小。

---

## 8. 技术设计约定

面向维护者 / 贡献者。开发时遵守,避免破坏"切换驱动零改动"承诺。

- **CSS 设计 Token**:颜色 / 圆角 / 阴影 / 过渡时长 统一挂 `:root` 和 `body.dark` 的 CSS 变量。禁止硬编码十六进制色值。
- **响应式断点**:平板 `≤768px`(导航变汉堡、网格 1 列);手机 `≤480px`(字号/内边距再压一档)。
- **无依赖原则**:不引入前端框架、不跑构建。仅在文章详情页 / 管理编辑器通过 CDN 引入 `marked.js` + `DOMPurify`。搜索/筛选都在浏览器本地完成,不调第三方搜索服务。
- **SQL 方言中立**(见 §5.4):占位符只用 `?`、时间戳 JS 端生成、新增表必须两份 DDL 各一份。
- **安全**:写操作走 `X-Admin-Password`;Markdown 渲染用 DOMPurify.sanitize() 消毒;存储层抽象避免直接操作 R2。
- **无障碍**:导航 `aria-label`、搜索弹窗 `aria-modal`、留言区 `aria-live`;`Ctrl/Cmd+K` 唤起全局搜索,`ESC` 关闭。

---

## 9. License

个人项目,按你需要的方式使用。
