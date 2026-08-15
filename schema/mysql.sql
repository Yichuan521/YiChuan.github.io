-- 文件：schema/mysql.sql — MySQL 建表 SQL（迁移到服务器时使用）
-- 与 schema/d1.sql 表结构一致，仅方言差异：AUTO_INCREMENT、反引号、ENGINE、UNIX_TIMESTAMP。
-- 迁移时配合 env.DB_DRIVER=mysql 与 HTTP 网关使用，详见 README 迁移说明。

CREATE TABLE IF NOT EXISTS guestbook (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  nickname VARCHAR(30) NOT NULL,
  email VARCHAR(60),
  content VARCHAR(500) NOT NULL,
  reply_to INTEGER,
  time INTEGER NOT NULL,
  INDEX idx_guestbook_reply (reply_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  url VARCHAR(255) NOT NULL,
  `desc` VARCHAR(200) NOT NULL,
  avatar VARCHAR(500) NOT NULL,
  time INTEGER NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  slug VARCHAR(80),
  type VARCHAR(16) NOT NULL DEFAULT 'post',
  sort INTEGER NOT NULL DEFAULT 0,
  time INTEGER NOT NULL,
  INDEX idx_categories_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200),
  content MEDIUMTEXT NOT NULL,
  excerpt VARCHAR(500),
  tags VARCHAR(255),
  category_id INTEGER,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  archived INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  time INTEGER NOT NULL,
  update_time INTEGER NOT NULL,
  INDEX idx_posts_slug (slug),
  INDEX idx_posts_status (status),
  INDEX idx_posts_category (category_id),
  INDEX idx_posts_archived (archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  url VARCHAR(500) NOT NULL,
  file_key VARCHAR(255),
  size INTEGER,
  file_type VARCHAR(64),
  category_id INTEGER,
  source VARCHAR(16) NOT NULL DEFAULT 'external',
  archived INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  time INTEGER NOT NULL,
  INDEX idx_resources_category (category_id),
  INDEX idx_resources_archived (archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  `key` VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  size INTEGER,
  mime VARCHAR(64),
  width INTEGER,
  height INTEGER,
  source VARCHAR(16) NOT NULL DEFAULT 'r2',
  uploaded_at INTEGER NOT NULL,
  INDEX idx_assets_uploaded (uploaded_at),
  UNIQUE KEY uq_assets_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
