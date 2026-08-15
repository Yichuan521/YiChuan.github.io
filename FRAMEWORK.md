# 框架标准化开发指南

> 本文件定义义川先森个人网站的**框架约定与贡献规范**。新增页面、组件、接口、表时务必遵守，保证全站风格一致、可迁移、可维护。
>
> 配套文档:[README.md](./README.md)(部署/数据库/API 总览) — 本文件聚焦"怎么写代码"。

---

## 目录

- [1. 技术栈与原则](#1-技术栈与原则)
- [2. 目录与分层](#2-目录与分层)
- [3. CSS 设计 Token 体系](#3-css-设计-token-体系)
- [4. HTML 页面骨架标准](#4-html-页面骨架标准)
- [5. JavaScript 模块化约定](#5-javascript-模块化约定)
- [6. Cloudflare Functions 后端约定](#6-cloudflare-functions-后端约定)
- [7. 数据库与 Schema 约定](#7-数据库与-schema-约定)
- [8. 新增页面/接口/表的标准化流程](#8-新增页面接口表的标准化流程)
- [9. 命名、可访问性、性能基线](#9-命名可访问性性能基线)

---

## 1. 技术栈与原则

| 维度 | 选型 | 说明 |
| --- | --- | --- |
| 前端 | 原生 HTML5 + CSS3 + 原生 JS(ES2020+) | **零框架、零 npm、零构建步骤**。项目根目录即静态资源根。 |
| 后端 | Cloudflare Pages Functions | 文件名即路由,`functions/api/posts.js` → `/api/posts`。 |
| 数据库 | Cloudflare D1(默认)/ MySQL(预留) | 通过 `functions/_lib/db.js` 适配器切换,业务代码零改动。 |
| 存储 | Cloudflare R2(可选)/ 外链降级 | 通过 `functions/_lib/storage.js` 适配器切换。 |
| 计数 | Cloudflare KV | `KV_COUNT` 绑定,IP 去重 + 30s 轮询。 |
| Markdown | marked.js + DOMPurify(CDN) | 仅文章详情页/管理编辑器按需引入。 |
| 主题 | CSS 变量 + `body.dark` 类 | 跟随 `prefers-color-scheme`,允许手动覆盖并存 `localStorage`。 |

**五条铁律**

1. 不引入前端框架、不跑构建。新增功能优先用原生 API。
2. 写操作必须鉴权(`X-Admin-Password`)。
3. SQL 方言中立:占位符只用 `?`、时间戳 JS 端生成、新增表必须两份 DDL。
4. CSS 禁止硬编码十六进制色值,一律走 `var(--*)` Token。
5. 所有用户输入渲染前必须 `escapeHtml` 或 `DOMPurify.sanitize`。

---

## 2. 目录与分层

```text
Yichuan521/
├── *.html                  访客页面(根目录即静态根)
├── yichuan.html            管理面板(独立入口)
├── _routes.json            Functions 路由白名单(仅放行 /api/*)
│
├── assets/
│   ├── css/style.css       全站样式(单文件,内部分区注释)
│   └── js/main.js          全站脚本(单文件,IIFE 隐式隔离)
│
└── functions/
    ├── _middleware.js      全局中间件(OPTIONS 预检 + 访问日志)
    ├── _lib/               适配器层(业务代码只 import 这一层)
    │   ├── http.js         cors / json / error / ok
    │   ├── auth.js         extractPassword / requireAdmin / withAuth
    │   ├── db.js           createDb → D1/MySQL 驱动(all/first/run/batch)
    │   └── storage.js      createStorage → R2/外链 驱动
    └── api/                路由层(按文件名自动映射 /api/<name>)
        ├── count.js        KV 计数
        ├── guestbook.js    留言 + 回复线程
        ├── friends.js      友链
        ├── categories.js   分类(post/resource 共用)
        ├── posts.js        文章(Markdown)
        ├── resources.js    资源(文件分享)
        ├── upload.js       图床(R2/外链)
        └── health.js       健康探针
```

**分层依赖方向**(单向,禁止逆引用):

```text
api/*.js ──► _lib/(http, auth, db, storage) ──► Cloudflare Runtime(env.DB/KV/R2)
```

- 业务路由 **只能** import `_lib/*`,不直接碰 `env.DB` / `env.R2_BUCKET`。
- `_lib/*` 不 import `api/*`,不写业务逻辑。

---

## 3. CSS 设计 Token 体系

定义在 [style.css](./assets/css/style.css#L1-L6) 顶部,所有样式必须引用变量,禁止裸色值。

### 3.1 Token 清单

| 分类 | 变量 | 用途 |
| --- | --- | --- |
| 表面 | `--bg` `--surface` `--nav` `--soft` | 页面底色 / 卡片 / 导航半透 / 轻染色块 |
| 主色 | `--primary` `--primary-hover` `--accent` | 主交互色 / hover / 辅助强调(渐变对) |
| 文字 | `--text` `--text-2` `--text-3` | 主文 / 次文 / 弱文(三档灰阶) |
| 分隔 | `--line` | 卡片边框、分隔线 |
| 标签 | `--tag-bg` `--tag-text` | 技能/分类标签配色 |
| 圆角 | `--radius-sm` 6px / `--radius-md` 12px / `--radius-lg` 20px | 三档圆角,禁止随意写新值 |
| 阴影 | `--shadow` / `--shadow-hover` | 静态 / 悬浮 |
| 动效 | `--ease` cubic-bezier(.4,0,.2,1) / `--duration` 240ms | 全站统一过渡曲线与时长 |

### 3.2 主题切换机制

```text
亮色(默认)     :root { --primary: #2563eb; ... }
手动暗色       body.dark { --primary: #60a5fa; ... }
系统暗色       @media(prefers-color-scheme:dark){ body:not(.light){...} }
```

- 手动切换由 [.theme-button](./assets/js/main.js#L14) 触发,写 `localStorage['site-theme']`。
- 用户已设手动主题时,系统媒体查询被 `body.light` / `body.dark` 类覆盖。
- 新增 Token 必须同时在三处定义,否则暗色下会回退到亮色值。

### 3.3 响应式断点

| 断点 | 触发 | 典型调整 |
| --- | --- | --- |
| `≤768px` | 平板 | 导航变汉堡菜单、网格 1 列、`.project-tools` 纵向堆叠 |
| `≤480px` | 手机 | 字号/内边距再压一档、卡片间距收紧 |

新增组件必须在这两个断点下测过,不允许新增其他自定义断点。

### 3.4 颜色混合约定

半透明叠层用 `color-mix(in srgb, var(--primary) N%, transparent)`,不要写 `rgba(...)` 硬编码,否则暗色下不跟随主题。

---

## 4. HTML 页面骨架标准

每个访客页面必须包含以下五块公共结构,顺序固定:

```html
<body data-page="页面标识">
  1. <header class="site-header"> … <nav class="site-nav"> … </nav> … </header>
  2. <main class="page-shell page-main reveal"> … </main>
  3. <footer class="site-footer"> … </footer>
  4. <div class="search-dialog" id="searchDialog"> … </div>
  5. <div class="toast" id="toast"></div>
  <script src="assets/js/main.js"></script>
</body>
```

### 4.1 导航栏(全站统一)

8 个主入口,顺序固定:**首页 / 关于 / 项目 / 文章 / 资源 / 归档 / 留言 / 友链**。新增一级页面在此插入,不要另起导航。

参考 [about.html](./about.html#L19-L27) 的 nav 写法。当前页高亮由 [main.js#L15-L17](./assets/js/main.js#L15-L17) 根据 `data-page` 自动加 `.active`,无需手写。

### 4.2 `data-page` 标识约定

| 页面 | data-page | navTarget(实际高亮项) |
| --- | --- | --- |
| index.html | `home` | `index` |
| article.html | `article` | `articles`(归到文章) |
| 其他 | 文件名去掉 .html | 同名 |

新增页面: `data-page` 设为文件名(无扩展名),nav 自动高亮同名链接。

### 4.3 工具条 `.project-tools` 标准组合

列表型页面(文章/资源/归档/项目)顶部工具条统一结构:

```html
<div class="project-tools">
  <label class="inline-search">…<input type="search" id="xxxSearch">…</label>
  <div class="filters" id="xxxFilters"><button class="active" data-filter="all">全部</button></div>
  <!-- 可选:跳转链接用 .archive-link,不要用切换按钮 -->
</div>
<p class="search-summary" id="xxxSummary" aria-live="polite"></p>
```

- 搜索框、分类筛选条、空态 `.empty-state` 是三件套,缺一不可。
- 归档等跨页跳转用 `<a class="archive-link">`,不要做原地 toggle。

---

## 5. JavaScript 模块化约定

全站脚本 [main.js](./assets/js/main.js) 单文件,顶部定义工具函数,底部统一调度初始化。

### 5.1 工具函数(顶部,全站可用)

| 函数 | 签名 | 用途 |
| --- | --- | --- |
| `$` | `(selector) => Element` | querySelector 简写 |
| `api` | `'/api'` | 接口基址常量 |
| `escapeHtml` | `(text) => string` | 转义 `& < > ' "` |
| `formatDate` | `(unixSeconds) => 'YYYY-MM-DD'` | 时间戳格式化 |
| `debounce` | `(fn, delay=300) => fn` | 搜索输入防抖 |
| `terms` / `matchText` | `(value)` / `(item, query)` | 关键词分词与匹配 |
| `renderMarkdown` | `(md, container) => void` | marked + DOMPurify + B 站短码 |

新增工具函数放顶部,命名小驼峰,不挂 `window`。

### 5.2 页面初始化分发

每个页面写一个 `initXxx()` 函数,函数内首行做守卫:

```javascript
function initXxx() {
  const list = $('#xxxList'); if (!list) return;  // 守卫:不在本页就退出
  // …本页逻辑
}
```

底部统一调度(无 router,顺序调用即可,守卫保证只命中本页):

```javascript
initProjects(); loadCount(); initCountRealtime();
loadGuestbook(); initFriends(); initBook();
initArticles(); loadArticleDetail(); initResources(); initArchive();
```

新增页面:写 `initXxx()` → 在末尾追加调用 → 不需要改分发机制。

### 5.3 公共能力位置

| 能力 | 位置 | 触发 |
| --- | --- | --- |
| 主题切换 | main.js#L14 | `.theme-button` 点击 |
| 当前页高亮 | main.js#L15-L17 | 自动,读 `data-page` |
| 移动端菜单 | main.js#L18-L19 | `.menu-button` 点击 |
| 全局搜索 | main.js#L22-L29 | `.search-button` / `Ctrl+K` / `ESC` |
| 访问计数 | main.js#L42-L67 | 首次 `loadCount()` + 30s 轮询,页面不可见暂停 |
| 年份填充 | main.js#L11 | `.current-year` 元素 |

### 5.4 列表渲染标准套路

```javascript
function initXxx() {
  const list = $('#xxxList'); if (!list) return;
  const search = $('#xxxSearch'), summary = $('#xxxSummary'), empty = $('#xxxEmpty');
  const filters = $('#xxxFilters');
  let allItems = [], filter = 'all';

  const render = () => {
    let results = allItems;
    if (filter !== 'all') results = results.filter(x => String(x.category_id) === filter);
    const q = search.value.trim().toLowerCase();
    if (q) results = results.filter(x => (x.name||'').toLowerCase().includes(q));
    summary.textContent = `共 ${results.length} 条`;
    empty.hidden = results.length > 0;
    list.innerHTML = results.map(cardTemplate).join('')
      || '<p class="form-message">暂无数据</p>';
  };

  // 1. 分类筛选条拉取
  fetch(`${api}/categories?type=xxx`).then(r=>r.json()).then(d=>{
    filters.innerHTML = '<button class="active" data-filter="all">全部</button>'
      + (d.categories||[]).map(c=>`<button data-filter="${c.id}">${escapeHtml(c.name)}</button>`).join('');
  }).catch(()=>{});

  // 2. 主数据拉取
  const load = () => {
    list.innerHTML = '<div class="skeleton"></div>'.repeat(3);
    fetch(`${api}/xxx`).then(r=>r.json()).then(d=>{ allItems = d.xxx||[]; render(); })
      .catch(()=>{ list.innerHTML = '<p class="form-message">加载失败</p>'; });
  };
  load();

  // 3. 事件绑定(搜索防抖 + 清空 + 筛选)
  search.addEventListener('input', debounce(render));
  $('#clearXxxSearch')?.addEventListener('click', ()=>{ search.value=''; render(); search.focus(); });
  filters.addEventListener('click', e=>{
    const b = e.target.closest('button'); if (!b) return;
    filter = b.dataset.filter;
    filters.querySelectorAll('button').forEach(x=>x.classList.toggle('active', x===b));
    render();
  });
}
```

---

## 6. Cloudflare Functions 后端约定

### 6.1 路由白名单

[_routes.json](./_routes.json) 只放行 `/api/*`,静态资源直接走 CDN。新增非 `/api` 路由需改此文件。

### 6.2 全局中间件

[_middleware.js](./functions/_middleware.js) 统一处理两件事:
1. **OPTIONS 预检** → 返回 204 + CORS 头,业务函数不再写 `onRequestOptions`。
2. **访问日志** → `console.log(method path -> status)`,在 Cloudflare Dashboard 实时可查。

### 6.3 HTTP 工具层 ([http.js](./functions/_lib/http.js))

| 导出 | 用途 |
| --- | --- |
| `cors` | CORS 头对象,所有响应都带 |
| `json(data, status=200)` | 成功 JSON 响应 |
| `error(message, status=400)` | 错误 JSON 响应,`{error: msg}` |
| `ok(extra={})` | `{ok:true, ...extra}` 快捷成功响应 |

**所有响应必须走这三个函数**,不要手写 `new Response()`。

### 6.4 鉴权层 ([auth.js](./functions/_lib/auth.js))

密码取值优先级(**高 → 低**):

1. `X-Admin-Password` 请求头(推荐,不进 CF 访问日志)
2. JSON body 的 `password` 字段(兼容)
3. `?password=` query(废弃中,会进日志)

两个核心函数:

```javascript
// 模式 A:手动鉴权(POST/PUT/DELETE 常用)
const password = extractPassword(request);
const auth = requireAdmin(env, password);
if (!auth.ok) return auth.response;   // 401 或 500 已封装好

// 模式 B:包装器(整个文件只鉴权时用)
export const onRequestPost = withAuth(async (ctx) => {
  // 鉴权已通过,直接写业务
  return ok({ id: 123 });
});
```

未配置 `ADMIN_PASSWORD` 返回 500,密码错误返回 401。

### 6.5 数据访问层 ([db.js](./functions/_lib/db.js))

`createDb(env)` 返回同构驱动对象,业务代码只调这四个方法:

| 方法 | 签名 | 返回 |
| --- | --- | --- |
| `all` | `(sql, params=[])` | 行数组 `[{...}]` |
| `first` | `(sql, params=[], col?)` | 单行对象,或指定列值,或 `null` |
| `run` | `(sql, params=[])` | `{success, meta, lastRowId}` |
| `batch` | `(stmts)` | `[stmt1Result, ...]`(stmts = `[{sql, params}]`) |

切换驱动只需改环境变量 `DB_DRIVER`,`api/*.js` 零改动。

### 6.6 存储层 ([storage.js](./functions/_lib/storage.js))

`createStorage(env)` 按 `R2_BUCKET` 是否绑定自动选驱动:

| 驱动 | `mode` | `put` | `url(key)` |
| --- | --- | --- | --- |
| R2 | `'r2'` | 真上传到 bucket | `${R2_PUBLIC_BASE}/${key}` 或 `null` |
| 外链 | `'external'` | 抛错(调用方应走 JSON `{url}`) | 原样返回 key |

业务方先 `if (storage.mode !== 'r2') return error('未启用 R2', 400)` 守卫。

### 6.7 新增 API 路由模板

新建 `functions/api/<name>.js`,按需导出 `onRequestGet/Post/Put/Delete`:

```javascript
import { createDb } from '../_lib/db.js';
import { requireAdmin, extractPassword } from '../_lib/auth.js';
import { json, error, ok } from '../_lib/http.js';

export async function onRequestGet({ env, request }) {
  const db = createDb(env);
  try {
    const rows = await db.all('SELECT * FROM xxx ORDER BY time DESC');
    return json({ items: rows });
  } catch (e) {
    return error(e.message || '查询失败', 500);
  }
}

export async function onRequestPost({ env, request }) {
  const password = extractPassword(request);
  const auth = requireAdmin(env, password);
  if (!auth.ok) return auth.response;

  const db = createDb(env);
  const body = await request.json();
  if (!body.name) return error('名称不能为空');
  const now = Math.floor(Date.now() / 1000);   // 时间戳 JS 端生成
  const r = await db.run('INSERT INTO xxx (name, time) VALUES (?, ?)', [body.name, now]);
  return ok({ id: r.lastRowId });
}
```

---

## 7. 数据库与 Schema 约定

### 7.1 通用列约定

所有业务表必须遵守:

| 列 | 类型 | 约定 |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | 自增主键 |
| `time` | `INTEGER NOT NULL` | 创建时间,秒级 Unix 时间戳(JS 端生成) |
| `archived` | `INTEGER NOT NULL DEFAULT 0` | 归档标记 `0`/`1`(可归档的表) |
| `category_id` | `INTEGER` | 关联 `categories.id`(可分类的表) |
| `*_time` | `INTEGER NOT NULL` | 更新时间等,同上秒级 |

### 7.2 现有表清单

| 表 | 共用字段 | 用途 |
| --- | --- | --- |
| `guestbook` | id, nickname, email, content, reply_to, time | 留言+回复(自关联) |
| `friends` | id, name, url, `"desc"`, avatar, time | 友链 |
| `categories` | id, name, slug, type, sort, time | 分类(`type=post`/`resource`) |
| `posts` | id, title, slug, content, excerpt, tags, category_id, status, archived, views, time, update_time | 文章 |
| `resources` | id, name, description, url, file_key, size, file_type, category_id, source, archived, downloads, time | 资源 |
| `assets` | id, key, url, filename, size, mime, width, height, source, uploaded_at | 图床素材 |

### 7.3 SQL 方言中立规范(强制)

| 维度 | 规定 | 原因 |
| --- | --- | --- |
| 占位符 | 统一 `?` | D1、MySQL、本地 SQLite 都支持 |
| 时间戳 | JS 端 `Math.floor(Date.now()/1000)` 作为 bind 参数 | 避免 `unixepoch()`(D1) vs `UNIX_TIMESTAMP()`(MySQL) |
| 保留字 | 列名避开 `desc` 等;DDL 里带引号 `"desc"` 出现 | 运行时用 `?` 绑定绕过 |
| 批量 | 不依赖 `RETURNING` / `last_insert_id()` 跨语句传播;先插主表取 ID → 再插子表(两次调用) | D1 batch 取不到中间 insert id |
| 索引命名 | `idx_<表>_<列>` / `uq_<表>_<列>` | 全站统一 |

方言差异**只出现在 `schema/d1.sql` 与 `schema/mysql.sql` 两份 DDL**,业务代码不出现任何方言特有函数。

### 7.4 新增表强制流程

1. 在 `schema/d1.sql` 追加 `CREATE TABLE IF NOT EXISTS ...` + 索引。
2. 在 `schema/mysql.sql` 追加对齐的 MySQL DDL(`AUTO_INCREMENT`、反引号、`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)。
3. 写对应的 `functions/api/<name>.js` 路由。
4. 如可分类,在 `categories` 表的 `type` 字段加新值,并更新前端筛选条拉取逻辑。

---

## 8. 新增页面/接口/表的标准化流程

### 8.1 新增访客页面

1. 根目录建 `<name>.html`,复制 [about.html](./about.html) 的五块公共结构。
2. `<body data-page="<name>">`,nav 自动高亮。
3. nav 里在合适位置插入 `<a href="<name>.html">显示名</a>`(顺序:首页/关于/项目/文章/资源/归档/留言/友链)。
4. 在 [main.js](./assets/js/main.js) 写 `init<Name>()` 函数(首行守卫 `if (!list) return`),底部追加调用。
5. 列表型页面套用 §5.4 的工具条三件套。

### 8.2 新增 API 接口

1. 在 `functions/api/` 建 `<name>.js`,导出 `onRequestGet/Post/Put/Delete`。
2. 顶部 import 三件套:`createDb` / `requireAdmin, extractPassword` / `json, error, ok`。
3. 写操作必须先 `requireAdmin` 守卫。
4. 响应一律走 `json/error/ok`,不手写 `new Response`。
5. 在 [README.md](./README.md) §6.2 路由速查表追加一行。

### 8.3 新增数据表

按 §7.4 的四步走,两份 DDL 缺一不可。

---

## 9. 命名、可访问性、性能基线

### 9.1 命名约定

| 对象 | 约定 | 示例 |
| --- | --- | --- |
| HTML 文件 | 全小写,连字符 | `archive.html` |
| CSS 类 | kebab-case | `.article-card` `.tag-row` |
| JS 函数/变量 | camelCase | `initArticles` `allPosts` |
| JS 常量 | UPPER_SNAKE | `API_BASE` |
| 数据库表 | snake_case 复数 | `posts` `categories` |
| 数据库列 | snake_case | `category_id` `update_time` |
| 环境变量 | UPPER_SNAKE | `ADMIN_PASSWORD` `R2_BUCKET` |
| R2 对象 key | `uploads/YYYY/MM/uuid.ext` | `uploads/2026/08/abc.png` |

### 9.2 可访问性基线

- 导航 `aria-label="主导航"`,菜单按钮 `aria-expanded`。
- 搜索弹窗 `role="dialog" aria-modal="true"`,Esc 关闭。
- 列表汇总 `aria-live="polite"`(搜索结果计数)。
- 所有可点击卡片用 `<a>` 而非 `<div onclick>`。
- 图标按钮必须带 `aria-label`。
- 颜色对比度:正文 `--text` on `--bg` ≥ 4.5:1(已满足 WCAG AA)。

### 9.3 性能基线

- 不引入前端框架,首屏 JS < 30KB(main.js 单文件)。
- 文章/管理编辑器的 marked + DOMPurify 走 CDN,**仅相关页面加载**。
- 列表搜索/筛选在浏览器本地完成,不调第三方搜索服务。
- 图片 `loading="lazy"`,头像 `object-fit:cover`。
- 计数轮询 30s 一次,页面不可见(`visibilitychange`)自动暂停。

### 9.4 安全基线

- 写操作必须 `X-Admin-Password` 鉴权。
- 用户输入渲染前必须 `escapeHtml`(文本)或 `DOMPurify.sanitize`(HTML)。
- Markdown 渲染管线:短码预处理 → marked → DOMPurify → 占位替换,顺序不可乱。
- 存储层抽象,业务代码不直接操作 `env.R2_BUCKET`。
- SQL 一律参数化(`?` 占位符),禁止字符串拼接。

---

*本文件随项目演进持续更新。新增约定请同步追加到对应章节,不要另起文档。*
