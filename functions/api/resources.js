// 文件：functions/api/resources.js — 资源接口（分享文件）
// GET:  列表 ?category=&archived=1|all&q= / 详情 ?id=
// POST/PUT/DELETE: 需鉴权。POST/PUT 时 source=external 走外链、source=r2 时从 assets 引用
import { createDb } from '../_lib/db.js';
import { requireAdmin, extractPassword } from '../_lib/auth.js';
import { json, error } from '../_lib/http.js';

// 列表查询的字段：不含 file_key（内部字段）
const LIST_COLS = 'id, name, description, url, size, file_type, category_id, category_name, source, archived, downloads, time';

// 拼接分类名（LEFT JOIN categories）
function listSql(where) {
  return `SELECT r.id, r.name, r.description, r.url, r.size, r.file_type,
                 r.category_id, c.name AS category_name, r.source, r.archived, r.downloads, r.time
          FROM resources r
          LEFT JOIN categories c ON c.id = r.category_id
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY r.time DESC`;
}

export async function onRequestGet({ env, request }) {
  const db = createDb(env);
  try {
    const u = new URL(request.url);
    const idParam = u.searchParams.get('id');

    // 单条详情 + 下载量自增（详情页用）
    if (idParam) {
      const row = await db.first(
        `SELECT r.*, c.name AS category_name FROM resources r
         LEFT JOIN categories c ON c.id = r.category_id WHERE r.id = ?`,
        [Number(idParam)]
      );
      if (!row) return error('资源不存在。', 404);
      await db.run('UPDATE resources SET downloads = downloads + 1 WHERE id = ?', [row.id]);
      row.downloads = (row.downloads || 0) + 1;
      return json({ resource: row });
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
  } catch (e) {
    return error(e.message || '查询失败。', 500);
  }
}

export async function onRequestPost({ env, request }) {
  const db = createDb(env);
  try {
    let body;
    try { body = await request.json(); } catch { return error('请求体格式错误。', 400); }
    const password = (body && body.password || '').toString();
    const auth = requireAdmin(env, password);
    if (!auth.ok) return auth.response;

    const name = (body.name || '').toString().trim();
    const description = (body.description || '').toString().trim();
    const url = (body.url || '').toString().trim();
    const source = (body.source || 'external').toString().trim();
    const fileKey = (body.file_key || '').toString().trim() || null;
    const size = body.size != null ? Number(body.size) : null;
    const fileType = (body.file_type || '').toString().trim() || null;
    const categoryId = body.category_id ? Number(body.category_id) : null;
    const archived = body.archived ? 1 : 0;

    if (!name) return error('资源名称不能为空。', 400);
    if (!url) return error('资源 URL 不能为空。', 400);
    if (!['external', 'r2'].includes(source)) return error('source 必须为 external 或 r2。', 400);

    await db.run(
      `INSERT INTO resources (name, description, url, file_key, size, file_type, category_id, source, archived, downloads, time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [name.slice(0, 120), description.slice(0, 500), url.slice(0, 500), fileKey,
       size, fileType, categoryId, source, archived, Math.floor(Date.now() / 1000)]
    );
    return json({ ok: true });
  } catch (e) {
    return error(e.message || '新增失败。', 500);
  }
}

export async function onRequestPut({ env, request }) {
  const db = createDb(env);
  try {
    let body;
    try { body = await request.json(); } catch { return error('请求体格式错误。', 400); }
    const password = (body && body.password || '').toString();
    const auth = requireAdmin(env, password);
    if (!auth.ok) return auth.response;

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) return error('缺少资源 ID。', 400);

    const name = (body.name || '').toString().trim();
    const description = (body.description || '').toString().trim();
    const url = (body.url || '').toString().trim();
    const source = (body.source || 'external').toString().trim();
    const fileKey = (body.file_key || '').toString().trim() || null;
    const size = body.size != null ? Number(body.size) : null;
    const fileType = (body.file_type || '').toString().trim() || null;
    const categoryId = body.category_id ? Number(body.category_id) : null;
    const archived = body.archived ? 1 : 0;

    if (!name || !url) return error('名称 / URL 不能为空。', 400);

    await db.run(
      `UPDATE resources SET name = ?, description = ?, url = ?, file_key = ?, size = ?, file_type = ?,
        category_id = ?, source = ?, archived = ? WHERE id = ?`,
      [name.slice(0, 120), description.slice(0, 500), url.slice(0, 500), fileKey,
       size, fileType, categoryId, source, archived, id]
    );
    return json({ ok: true });
  } catch (e) {
    return error(e.message || '更新失败。', 500);
  }
}

export async function onRequestDelete({ env, request }) {
  const db = createDb(env);
  try {
    const u = new URL(request.url);
    const id = u.searchParams.get('id');
    const password = extractPassword(request);
    const auth = requireAdmin(env, password);
    if (!auth.ok) return auth.response;
    if (!id) return error('缺少资源 ID。', 400);

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
  } catch (e) {
    return error(e.message || '删除失败。', 500);
  }
}
