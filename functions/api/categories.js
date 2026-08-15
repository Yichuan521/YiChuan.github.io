// 文件：functions/api/categories.js
// 分类接口 — 参考 Cloudflare Pages Functions 官方风格重写。
//
// 路由（仅实现前端实际调用的）：
//   GET    /api/categories         列表（?type=post|resource，默认 post）
//   POST   /api/categories         新增（鉴权）
//   PUT    /api/categories         编辑（鉴权，body 含 id）
//   DELETE /api/categories?id=N    删除（鉴权，原子地把引用置空后删分类）
//
// 鉴权：从 X-Admin-Password header 取（前端 authHeaders() 注入），不再从 body.password 取。

import { createDb } from '../_lib/db.js';
import { requireAdmin, extractPassword } from '../_lib/auth.js';
import { json, error, wrap } from '../_lib/http.js';

/* ============ 工具 ============ */
function buildCategoryFields(body) {
  const name = (body.name || '').toString().trim();
  const slug = (body.slug || '').toString().trim() || null;
  const sort = Number(body.sort) || 0;
  return { name, slug, sort };
}

/* ============ GET ============ */
export const onRequestGet = wrap(async ({ env, request }) => {
  const db = createDb(env);
  const u = new URL(request.url);
  const type = u.searchParams.get('type') || 'post';
  const rows = await db.all(
    'SELECT id, name, slug, type, sort, time FROM categories WHERE type = ? ORDER BY sort ASC, id ASC',
    [type]
  );
  return json({ categories: rows });
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

  const name = (body.name || '').toString().trim();
  const type = (body.type || 'post').toString().trim();
  const slug = (body.slug || '').toString().trim() || null;
  const sort = Number(body.sort) || 0;
  if (!name) return error('分类名称不能为空。', 400, 'BAD_FIELDS');
  if (!['post', 'resource'].includes(type)) return error('分类类型无效。', 400, 'BAD_FIELDS');

  await db.run(
    'INSERT INTO categories (name, slug, type, sort, time) VALUES (?, ?, ?, ?, ?)',
    [name.slice(0, 60), slug, type, sort, Math.floor(Date.now() / 1000)]
  );
  return json({ ok: true });
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

  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) return error('缺少分类 ID。', 400, 'BAD_ID');

  const f = buildCategoryFields(body);
  if (!f.name) return error('分类名称不能为空。', 400, 'BAD_FIELDS');

  await db.run(
    'UPDATE categories SET name = ?, slug = ?, sort = ? WHERE id = ?',
    [f.name.slice(0, 60), f.slug, f.sort, id]
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
  if (!id) return error('缺少分类 ID。', 400, 'BAD_ID');

  // 原子批量：把该分类下的文章/资源 category_id 置空，再删分类
  await db.batch([
    { sql: 'UPDATE posts SET category_id = NULL WHERE category_id = ?', params: [Number(id)] },
    { sql: 'UPDATE resources SET category_id = NULL WHERE category_id = ?', params: [Number(id)] },
    { sql: 'DELETE FROM categories WHERE id = ?', params: [Number(id)] },
  ]);
  return json({ ok: true });
});
