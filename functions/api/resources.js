// 文件：functions/api/resources.js
// 资源接口 — 参考 Cloudflare Pages Functions 官方风格重写。
//
// 路由（仅实现前端实际调用的）：
//   GET    /api/resources              列表（?archived=0|1|all &category=&q=）
//   GET    /api/resources?id=N         单条详情（downloads+1）
//   POST   /api/resources              新增（鉴权）
//   PUT    /api/resources              编辑（鉴权，body 含 id）
//   DELETE /api/resources?id=N         删除（鉴权，R2 资源同时删 R2 对象）
//
// 鉴权：从 X-Admin-Password header 取（前端 authHeaders() 注入），不再从 body.password 取。

import { createDb } from '../_lib/db.js';
import { requireAdmin, extractPassword } from '../_lib/auth.js';
import { json, error, wrap } from '../_lib/http.js';

/* ============ 工具 ============ */
// 构造资源字段（POST/PUT 复用）
function buildResourceFields(body) {
  const name = (body.name || '').toString().trim();
  const description = (body.description || '').toString().trim();
  const url = (body.url || '').toString().trim();
  const source = (body.source || 'external').toString().trim();
  const fileKey = (body.file_key || '').toString().trim() || null;
  const size = body.size != null ? Number(body.size) : null;
  const fileType = (body.file_type || '').toString().trim() || null;
  const categoryId = body.category_id ? Number(body.category_id) : null;
  const archived = body.archived ? 1 : 0;
  return { name, description, url, source, fileKey, size, fileType, categoryId, archived };
}

// 列表查询 SQL（LEFT JOIN categories 取分类名）
function listSql(where) {
  return `SELECT r.id, r.name, r.description, r.url, r.size, r.file_type,
                 r.category_id, c.name AS category_name, r.source, r.archived, r.downloads, r.time
          FROM resources r
          LEFT JOIN categories c ON c.id = r.category_id
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY r.time DESC`;
}

/* ============ GET ============ */
export const onRequestGet = wrap(async ({ env, request }) => {
  const db = createDb(env);
  const u = new URL(request.url);
  const idParam = u.searchParams.get('id');

  // 单条详情（downloads +1）
  if (idParam) {
    const row = await db.first(
      `SELECT r.*, c.name AS category_name FROM resources r
       LEFT JOIN categories c ON c.id = r.category_id WHERE r.id = ?`,
      [Number(idParam)]
    );
    if (!row) return error('资源不存在。', 404, 'NOT_FOUND');
    await db.run('UPDATE resources SET downloads = downloads + 1 WHERE id = ?', [row.id]);
    return json({ resource: { ...row, downloads: (row.downloads || 0) + 1 } });
  }

  // 列表
  const where = [];
  const params = [];
  const archived = u.searchParams.get('archived');
  const category = u.searchParams.get('category');
  const q = u.searchParams.get('q');

  if (archived === '1') where.push('r.archived = 1');
  else if (archived !== 'all') where.push('r.archived = 0');

  if (category) { where.push('r.category_id = ?'); params.push(Number(category)); }
  if (q) {
    where.push('(r.name LIKE ? OR r.description LIKE ?)');
    const kw = `%${q}%`;
    params.push(kw, kw);
  }

  const rows = await db.all(listSql(where), params);
  return json({ resources: rows });
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

  const f = buildResourceFields(body);
  if (!f.name) return error('资源名称不能为空。', 400, 'BAD_FIELDS');
  if (!f.url) return error('资源 URL 不能为空。', 400, 'BAD_FIELDS');
  if (!['external', 'r2'].includes(f.source)) return error('source 必须为 external 或 r2。', 400, 'BAD_FIELDS');

  await db.run(
    `INSERT INTO resources (name, description, url, file_key, size, file_type, category_id, source, archived, downloads, time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [f.name.slice(0, 120), f.description.slice(0, 500), f.url.slice(0, 500), f.fileKey,
     f.size, f.fileType, f.categoryId, f.source, f.archived, Math.floor(Date.now() / 1000)]
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
  if (!Number.isFinite(id) || id <= 0) return error('缺少资源 ID。', 400, 'BAD_ID');

  const f = buildResourceFields(body);
  if (!f.name || !f.url) return error('名称 / URL 不能为空。', 400, 'BAD_FIELDS');

  await db.run(
    `UPDATE resources SET name = ?, description = ?, url = ?, file_key = ?, size = ?, file_type = ?,
      category_id = ?, source = ?, archived = ? WHERE id = ?`,
    [f.name.slice(0, 120), f.description.slice(0, 500), f.url.slice(0, 500), f.fileKey,
     f.size, f.fileType, f.categoryId, f.source, f.archived, id]
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
  if (!id) return error('缺少资源 ID。', 400, 'BAD_ID');

  // 若是 R2 资源，顺便删 R2 对象
  const row = await db.first('SELECT file_key, source FROM resources WHERE id = ?', [Number(id)]);
  if (row && row.source === 'r2' && row.file_key) {
    try {
      const { createStorage } = await import('../_lib/storage.js');
      const storage = createStorage(env);
      if (storage.mode === 'r2') await storage.del(row.file_key);
    } catch { /* R2 未绑定或删除失败，不阻断 DB 删除 */ }
  }
  await db.run('DELETE FROM resources WHERE id = ?', [Number(id)]);
  return json({ ok: true });
});
