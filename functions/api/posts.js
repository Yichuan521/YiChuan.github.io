// 文件：functions/api/posts.js
// 文章接口 — 参考 Cloudflare Pages Functions 官方风格重写。
// 文档：https://developers.cloudflare.com/pages/functions/api-reference/
//
// 路由（仅实现前端实际调用的）：
//   GET    /api/posts              列表（?status=draft|published|all &archived=0|1|all &category=&q=）
//   GET    /api/posts?id=N         单篇详情（含 content，views+1）
//   GET    /api/posts?slug=xxx     按 slug 查详情
//   POST   /api/posts              新增（鉴权）
//   PUT    /api/posts              编辑（鉴权，body 必须含 id）
//   DELETE /api/posts?id=N         删除（鉴权）
//
// 鉴权：从 X-Admin-Password header 取（前端 authHeaders() 注入），不再从 body.password 取。

import { createDb } from '../_lib/db.js';
import { requireAdmin, extractPassword } from '../_lib/auth.js';
import { json, error, wrap } from '../_lib/http.js';

/* ============ 工具 ============ */
// slug 生成：英文标题转 kebab；中文/空 → 时间戳兜底
function makeSlug(title, time) {
  const t = (title || '').toLowerCase().trim();
  const cleaned = t.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || `p${time}`;
}

// 从 Markdown 提取纯文本摘要
function makeExcerpt(content, fallback) {
  if (fallback) return fallback;
  return (content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*`_\-\[\]!()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

// 统一构造文章 row（用于 POST/PUT 复用）
function buildPostFields(body, time, existing) {
  const title = (body.title || '').toString().trim();
  const content = (body.content || '').toString();
  const slug = (body.slug || '').toString().trim()
    || (existing && existing.slug) || makeSlug(title, time);
  const excerpt = makeExcerpt(content, (body.excerpt || '').toString().trim());
  const tags = (body.tags || '').toString().trim();
  const categoryId = body.category_id ? Number(body.category_id) : null;
  const status = body.status === 'published' ? 'published' : 'draft';
  const archived = body.archived ? 1 : 0;
  return { title, content, slug, excerpt, tags, categoryId, status, archived };
}

/* ============ GET ============ */
export const onRequestGet = wrap(async ({ env, request }) => {
  const db = createDb(env);
  const u = new URL(request.url);
  const slug = u.searchParams.get('slug');
  const idParam = u.searchParams.get('id');

  // 单篇详情
  if (slug || idParam) {
    const row = slug
      ? await db.first('SELECT * FROM posts WHERE slug = ?', [slug])
      : await db.first('SELECT * FROM posts WHERE id = ?', [Number(idParam)]);
    if (!row) return error('文章不存在。', 404, 'NOT_FOUND');
    await db.run('UPDATE posts SET views = views + 1 WHERE id = ?', [row.id]);
    const cat = row.category_id
      ? await db.first('SELECT id, name, slug FROM categories WHERE id = ?', [row.category_id])
      : null;
    return json({ post: { ...row, views: (row.views || 0) + 1, category: cat } });
  }

  // 列表查询
  const where = [];
  const params = [];
  const status = u.searchParams.get('status');
  const archived = u.searchParams.get('archived');
  const category = u.searchParams.get('category');
  const q = u.searchParams.get('q');

  // 默认只看 published + 未归档；管理端可传 status=all / archived=all
  if (status && status !== 'all') { where.push('p.status = ?'); params.push(status); }
  else if (!status) { where.push("p.status = 'published'"); }

  if (archived === '1') where.push('p.archived = 1');
  else if (archived !== 'all') where.push('p.archived = 0');

  if (category) { where.push('p.category_id = ?'); params.push(Number(category)); }
  if (q) {
    where.push('(p.title LIKE ? OR p.excerpt LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const sql =
    'SELECT p.id, p.title, p.slug, p.excerpt, p.tags, p.category_id, c.name AS category_name, ' +
    'p.status, p.archived, p.views, p.time, p.update_time ' +
    'FROM posts p LEFT JOIN categories c ON c.id = p.category_id ' +
    (where.length ? 'WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY p.time DESC LIMIT 200';
  const rows = await db.all(sql, params);
  return json({ posts: rows });
});

/* ============ POST ============ */
export const onRequestPost = wrap(async ({ env, request }) => {
  const db = createDb(env);
  const password = extractPassword(request);
  const auth = requireAdmin(env, password);
  if (!auth.ok) return auth.response;

  let body;
  try { body = await request.json(); }
  catch { return error('请求体格式错误。', 400, 'BAD_BODY'); }

  const time = Math.floor(Date.now() / 1000);
  const f = buildPostFields(body, time, null);
  if (!f.title || !f.content) return error('标题和内容不能为空。', 400, 'BAD_FIELDS');

  const r = await db.run(
    'INSERT INTO posts (title, slug, content, excerpt, tags, category_id, status, archived, time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [f.title.slice(0, 200), f.slug.slice(0, 200), f.content, f.excerpt, f.tags.slice(0, 255), f.categoryId, f.status, f.archived, time, time]
  );
  return json({ ok: true, id: r.lastRowId, slug: f.slug });
});

/* ============ PUT ============ */
export const onRequestPut = wrap(async ({ env, request }) => {
  const db = createDb(env);
  const password = extractPassword(request);
  const auth = requireAdmin(env, password);
  if (!auth.ok) return auth.response;

  let body;
  try { body = await request.json(); }
  catch { return error('请求体格式错误。', 400, 'BAD_BODY'); }

  const id = body && Number(body.id);
  if (!Number.isFinite(id) || id <= 0) return error('缺少文章 ID。', 400, 'BAD_ID');

  const time = Math.floor(Date.now() / 1000);
  const existing = await db.first('SELECT slug FROM posts WHERE id = ?', [id]);
  if (!existing) return error('文章不存在。', 404, 'NOT_FOUND');
  const f = buildPostFields(body, time, existing);
  if (!f.title || !f.content) return error('标题和内容不能为空。', 400, 'BAD_FIELDS');

  await db.run(
    'UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, tags = ?, category_id = ?, status = ?, archived = ?, update_time = ? WHERE id = ?',
    [f.title.slice(0, 200), f.slug.slice(0, 200), f.content, f.excerpt, f.tags.slice(0, 255), f.categoryId, f.status, f.archived, time, id]
  );
  return json({ ok: true });
});

/* ============ DELETE ============ */
export const onRequestDelete = wrap(async ({ env, request }) => {
  const db = createDb(env);
  const password = extractPassword(request);
  const auth = requireAdmin(env, password);
  if (!auth.ok) return auth.response;

  const u = new URL(request.url);
  const id = u.searchParams.get('id');
  if (!id) return error('缺少文章 ID。', 400, 'BAD_ID');

  await db.run('DELETE FROM posts WHERE id = ?', [Number(id)]);
  return json({ ok: true });
});
