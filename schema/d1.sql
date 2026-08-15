-- 文件：schema/d1.sql — Cloudflare D1 建表 SQL（在 D1 控制台 SQL 编辑器执行）
-- 全量建表，包含留言板、友链、分类、文章、资源（资源表预建，阶段2启用）。
-- 业务 SQL 用方言中立写法：? 占位符、时间戳由 JS 算好传入、列名避开 desc 等保留字。

-- 留言板（已存在则跳过；旧表如缺 email/reply_to 列，见 README 的 ALTER 语句）
CREATE TABLE IF NOT EXISTS guestbook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  email TEXT,
  content TEXT NOT NULL,
  reply_to INTEGER,
  time INTEGER NOT NULL
);

-- 友链
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  "desc" TEXT NOT NULL,
  avatar TEXT NOT NULL,
  time INTEGER NOT NULL
);

-- 分类（文章/资源共用，type 字段区分）
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT,
  type TEXT NOT NULL DEFAULT 'post',   -- post | resource
  sort INTEGER NOT NULL DEFAULT 0,
  time INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);

-- 文章
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT,                            -- URL 友好标识，用于 article.html?slug=xxx
  content TEXT NOT NULL,                -- 原始 Markdown
  excerpt TEXT,                         -- 摘要，列表展示用
  tags TEXT,                            -- 逗号分隔，避免关联表（D1 batch 拿不到 insert id）
  category_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published
  archived INTEGER NOT NULL DEFAULT 0,  -- 0 | 1
  views INTEGER NOT NULL DEFAULT 0,
  time INTEGER NOT NULL,                -- 创建时间
  update_time INTEGER NOT NULL          -- 更新时间
);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_archived ON posts(archived);

-- 资源（分享文件：外链或 R2 对象）
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,                    -- 外链 URL 或 R2 公开 URL
  file_key TEXT,                        -- R2 对象 key（外链模式为空）
  size INTEGER,                         -- 字节数
  file_type TEXT,                       -- 后缀或 mime
  category_id INTEGER,
  source TEXT NOT NULL DEFAULT 'external', -- external | r2
  archived INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  time INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category_id);
CREATE INDEX IF NOT EXISTS idx_resources_archived ON resources(archived);

-- 图床（assets）：后台上传的所有素材统一存这里，文章/资源可引用其 URL
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,                    -- R2 对象 key 或外链 URL（唯一标识）
  url TEXT NOT NULL,                    -- 可访问的最终 URL
  filename TEXT NOT NULL,               -- 原始文件名
  size INTEGER,                         -- 字节数
  mime TEXT,                            -- MIME 类型
  width INTEGER,                        -- 图片宽度（仅图片）
  height INTEGER,                       -- 图片高度（仅图片）
  source TEXT NOT NULL DEFAULT 'r2',    -- r2 | external
  uploaded_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assets_uploaded ON assets(uploaded_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_key ON assets(key);
