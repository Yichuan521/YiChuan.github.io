// 文件：functions/api/friends.js — 友链接口（迁移到 _lib 适配器，行为不变）
import { createDb } from '../_lib/db.js';
import { requireAdmin, extractPassword } from '../_lib/auth.js';
import { json, error } from '../_lib/http.js';

export async function onRequestGet({ env }) {
  const db = createDb(env);
  try {
    const friends = await db.all('SELECT id, name, url, "desc", avatar, time FROM friends ORDER BY time ASC');
    return json({ friends });
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
    const name = body && (body.name || '').toString().trim();
    const url = body && (body.url || '').toString().trim();
    const desc = body && (body.desc || '').toString().trim();
    const avatar = body && (body.avatar || '').toString().trim();
    if (!name || !url || !desc) return error('名称 / URL / 简介不能为空。', 400);
    await db.run(
      'INSERT INTO friends (name, url, "desc", avatar, time) VALUES (?, ?, ?, ?, ?)',
      [
        name.slice(0, 60),
        url.slice(0, 255),
        desc.slice(0, 200),
        (avatar || 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(url) + '&sz=64').slice(0, 500),
        Math.floor(Date.now() / 1000)
      ]
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
    if (!Number.isFinite(id) || id <= 0) return error('缺少友链 ID。', 400);
    const name = (body.name || '').toString().trim();
    const url = (body.url || '').toString().trim();
    const desc = (body.desc || '').toString().trim();
    const avatar = (body.avatar || '').toString().trim();
    if (!name || !url || !desc) return error('名称 / URL / 简介不能为空。', 400);
    await db.run(
      'UPDATE friends SET name = ?, url = ?, "desc" = ?, avatar = ? WHERE id = ?',
      [
        name.slice(0, 60),
        url.slice(0, 255),
        desc.slice(0, 200),
        (avatar || 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(url) + '&sz=64').slice(0, 500),
        id
      ]
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
    if (!id) return error('缺少友链 ID。', 400);
    await db.run('DELETE FROM friends WHERE id = ?', [id]);
    return json({ ok: true });
  } catch (e) {
    return error(e.message || '删除失败。', 500);
  }
}
