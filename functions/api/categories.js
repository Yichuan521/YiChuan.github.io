// 文件：functions/api/categories.js — 分类接口（文章/资源共用，type 区分）
import { createDb } from '../_lib/db.js';
import { requireAdmin, extractPassword } from '../_lib/auth.js';
import { json, error } from '../_lib/http.js';

export async function onRequestGet({ env, request }) {
  const db = createDb(env);
  try {
    const u = new URL(request.url);
    const type = u.searchParams.get('type') || 'post';
    const rows = await db.all(
      'SELECT id, name, slug, type, sort, time FROM categories WHERE type = ? ORDER BY sort ASC, id ASC',
      [type]
    );
    return json({ categories: rows });
  } catch (e) {
    return error(e.message || '查询失败。', 500);
  }
}

export async function onRequestPost({ env, request }) {
  const db = createDb(env);
  try {
    let body;
    try { body = await request.json(); } catch { return error('请求体格式错误。', 400); }
    const password = body && (body.password || '').toString();
    const auth = requireAdmin(env, password);
    if (!auth.ok) return auth.response;
    const name = (body.name || '').toString().trim();
    const type = (body.type || 'post').toString().trim();
    const slug = (body.slug || '').toString().trim() || null;
    const sort = Number(body.sort) || 0;
    if (!name) return error('分类名称不能为空。', 400);
    if (!['post', 'resource'].includes(type)) return error('分类类型无效。', 400);
    await db.run(
      'INSERT INTO categories (name, slug, type, sort, time) VALUES (?, ?, ?, ?, ?)',
      [name.slice(0, 60), slug, type, sort, Math.floor(Date.now() / 1000)]
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
    const password = body && (body.password || '').toString();
    const auth = requireAdmin(env, password);
    if (!auth.ok) return auth.response;
    const id = body && Number(body.id);
    if (!Number.isFinite(id) || id <= 0) return error('缺少分类 ID。', 400);
    const name = (body.name || '').toString().trim();
    const slug = (body.slug || '').toString().trim() || null;
    const sort = Number(body.sort) || 0;
    if (!name) return error('分类名称不能为空。', 400);
    await db.run(
      'UPDATE categories SET name = ?, slug = ?, sort = ? WHERE id = ?',
      [name.slice(0, 60), slug, sort, id]
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
    if (!id) return error('缺少分类 ID。', 400);
    // 把该分类下的文章/资源 category_id 置空，再删分类（原子批量）
    await db.batch([
      { sql: 'UPDATE posts SET category_id = NULL WHERE category_id = ?', params: [id] },
      { sql: 'UPDATE resources SET category_id = NULL WHERE category_id = ?', params: [id] },
      { sql: 'DELETE FROM categories WHERE id = ?', params: [id] },
    ]);
    return json({ ok: true });
  } catch (e) {
    return error(e.message || '删除失败。', 500);
  }
}
