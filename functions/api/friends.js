// 文件：functions/api/friends.js
// 友链接口 — 参考 Cloudflare Pages Functions 官方风格重写。
//
// 路由（仅实现前端实际调用的）：
//   GET    /api/friends          列表
//   POST   /api/friends          新增（鉴权）
//   PUT    /api/friends          编辑（鉴权，body 含 id）
//   DELETE /api/friends?id=N     删除（鉴权）
//
// 鉴权：从 X-Admin-Password header 取（前端 authHeaders() 注入），不再从 body.password 取。

import { createDb } from '../_lib/db.js';
import { requireAdmin, extractPassword } from '../_lib/auth.js';
import { json, error, wrap } from '../_lib/http.js';

/* ============ 工具 ============ */
// 构造友链字段（POST/PUT 复用）
function buildFriendFields(body) {
  const name = (body.name || '').toString().trim();
  const url = (body.url || '').toString().trim();
  const desc = (body.desc || '').toString().trim();
  const avatar = (body.avatar || '').toString().trim();
  // 头像为空时自动用 Google favicon 服务（按 URL 域名取站点图标）
  const finalAvatar = avatar || ('https://www.google.com/s2/favicons?domain=' + encodeURIComponent(url) + '&sz=64');
  return { name, url, desc, avatar: finalAvatar };
}

/* ============ GET ============ */
export const onRequestGet = wrap(async ({ env }) => {
  const db = createDb(env);
  const friends = await db.all('SELECT id, name, url, "desc", avatar, time FROM friends ORDER BY time ASC');
  return json({ friends });
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

  const f = buildFriendFields(body);
  if (!f.name || !f.url || !f.desc) return error('名称 / URL / 简介不能为空。', 400, 'BAD_FIELDS');

  await db.run(
    'INSERT INTO friends (name, url, "desc", avatar, time) VALUES (?, ?, ?, ?, ?)',
    [f.name.slice(0, 60), f.url.slice(0, 255), f.desc.slice(0, 200), f.avatar.slice(0, 500), Math.floor(Date.now() / 1000)]
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
  if (!Number.isFinite(id) || id <= 0) return error('缺少友链 ID。', 400, 'BAD_ID');

  const f = buildFriendFields(body);
  if (!f.name || !f.url || !f.desc) return error('名称 / URL / 简介不能为空。', 400, 'BAD_FIELDS');

  await db.run(
    'UPDATE friends SET name = ?, url = ?, "desc" = ?, avatar = ? WHERE id = ?',
    [f.name.slice(0, 60), f.url.slice(0, 255), f.desc.slice(0, 200), f.avatar.slice(0, 500), id]
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
  if (!id) return error('缺少友链 ID。', 400, 'BAD_ID');

  await db.run('DELETE FROM friends WHERE id = ?', [Number(id)]);
  return json({ ok: true });
});
