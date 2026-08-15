// 文件：functions/api/guestbook.js — 留言板接口（迁移到 _lib 适配器，行为不变）
import { createDb } from '../_lib/db.js';
import { requireAdmin, extractPassword } from '../_lib/auth.js';
import { json, error } from '../_lib/http.js';

export async function onRequestGet({ env }) {
  const db = createDb(env);
  try {
    const all = await db.all(
      'SELECT id, nickname, email, content, reply_to, time FROM guestbook ORDER BY time DESC'
    );
    const roots = all.filter((m) => !m.reply_to);
    const repliesMap = {};
    for (const r of all.filter((m) => m.reply_to)) {
      const parent = Number(r.reply_to);
      if (!repliesMap[parent]) repliesMap[parent] = [];
      repliesMap[parent].push(r);
    }
    const messages = roots.map((m) => ({
      ...m,
      replies: (repliesMap[Number(m.id)] || []).sort((a, b) => Number(a.time) - Number(b.time)),
    }));
    return json({ messages });
  } catch (e) {
    return error(e.message || '查询失败。', 500);
  }
}

export async function onRequestPost({ env, request }) {
  const db = createDb(env);
  try {
    let body;
    try { body = await request.json(); } catch { return error('请求体格式错误。', 400); }
    const nickname = body && (body.nickname || '').toString().trim();
    const email = body && (body.email || '').toString().trim();
    const content = body && (body.content || '').toString().trim();
    const replyToRaw = body && body.reply_to;
    const replyTo = replyToRaw == null || replyToRaw === '' ? null : Number(replyToRaw);

    if (!nickname || !content) return error('昵称和内容不能为空。', 400);
    if (replyTo !== null && (!Number.isFinite(replyTo) || replyTo <= 0)) return error('回复目标无效。', 400);

    if (replyTo !== null) {
      const exists = await db.first('SELECT id FROM guestbook WHERE id = ?', [replyTo], 'id');
      if (!exists) return error('要回复的留言不存在。', 404);
    }

    await db.run(
      'INSERT INTO guestbook (nickname, email, content, reply_to, time) VALUES (?, ?, ?, ?, ?)',
      [
        nickname.slice(0, 30),
        email ? email.slice(0, 60) : null,
        content.slice(0, 500),
        replyTo,
        Math.floor(Date.now() / 1000)
      ]
    );
    return json({ ok: true });
  } catch (e) {
    return error(e.message || '发布失败。', 500);
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
    if (!id) return error('缺少留言 ID。', 400);
    // 连同回复一起删除
    await db.run('DELETE FROM guestbook WHERE id = ? OR reply_to = ?', [id, id]);
    return json({ ok: true });
  } catch (e) {
    return error(e.message || '删除失败。', 500);
  }
}
