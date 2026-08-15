// 文件：functions/api/posts.js — 文章接口
// GET: 列表（?category= ?archived=1|all ?status=draft|all ?q=）或单篇详情（?slug= 或 ?id=）
// POST/PUT/DELETE: 需鉴权。服务端只存原始 Markdown，渲染在前端做。
import { createDb } from '../_lib/db.js';
import { requireAdmin, extractPassword } from '../_lib/auth.js';
import { json, error } from '../_lib/http.js';

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

export async function onRequestGet({ env, request }) {
  const db = createDb(env);
  try {
    const u = new URL(request.url);
    const slug = u.searchParams.get('slug');
    const idParam = u.searchParams.get('id');

    // 单篇详情（含 content，浏览量 +1）
    if (slug || idParam) {
      let row;
      if (slug) row = await db.first('SELECT * FROM posts WHERE slug = ?', [slug]);
      else row = await db.first('SELECT * FROM posts WHERE id = ?', [Number(idParam)]);
      if (!row) return error('文章不存在。', 404);
      await db.run('UPDATE posts SET views = views + 1 WHERE id = ?', [row.id]);
      const cat = row.category_id
        ? await db.first('SELECT id, name, slug FROM categories WHERE id = ?', [row.category_id])
        : null;
      return json({ post: { ...row, category: cat } });
    }

    // 列表
    const where = [];
    const params = [];
    const status = u.searchParams.get('status');
    const archived = u.searchParams.get('archived');
    const category = u.searchParams.get('category');
    const q = u.searchParams.get('q');

    // 默认只看 published + 未归档；管理端可传 status=all / archived=all 看全部
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
      'SELECT p.id, p.title, p.slug, p.excerpt, p.tags, p.category_id, c.name AS category_name, p.status, p.archived, p.views, p.time, p.update_time ' +
      'FROM posts p LEFT JOIN categories c ON c.id = p.category_id ' +
      (where.length ? 'WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY p.time DESC LIMIT 200';
    const rows = await db.all(sql, params);
    return json({ posts: rows });
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

    const title = (body.title || '').toString().trim();
    const content = (body.content || '').toString();
    if (!title || !content) return error('标题和内容不能为空。', 400);

    const time = Math.floor(Date.now() / 1000);
    const slug = (body.slug || '').toString().trim() || makeSlug(title, time);
    const excerpt = makeExcerpt(content, (body.excerpt || '').toString().trim());
    const tags = (body.tags || '').toString().trim();
    const categoryId = body.category_id ? Number(body.category_id) : null;
    const status = body.status === 'published' ? 'published' : 'draft';
    const archived = body.archived ? 1 : 0;

    const r = await db.run(
      'INSERT INTO posts (title, slug, content, excerpt, tags, category_id, status, archived, time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title.slice(0, 200), slug.slice(0, 200), content, excerpt, tags.slice(0, 255), categoryId, status, archived, time, time]
    );
    return json({ ok: true, id: r.lastRowId, slug });
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
    if (!Number.isFinite(id) || id <= 0) return error('缺少文章 ID。', 400);

    const title = (body.title || '').toString().trim();
    const content = (body.content || '').toString();
    if (!title || !content) return error('标题和内容不能为空。', 400);

    const time = Math.floor(Date.now() / 1000);
    const existing = await db.first('SELECT slug FROM posts WHERE id = ?', [id]);
    const slug = (body.slug || '').toString().trim() || (existing && existing.slug) || makeSlug(title, time);
    const excerpt = makeExcerpt(content, (body.excerpt || '').toString().trim());
    const tags = (body.tags || '').toString().trim();
    const categoryId = body.category_id ? Number(body.category_id) : null;
    const status = body.status === 'published' ? 'published' : 'draft';
    const archived = body.archived ? 1 : 0;

    await db.run(
      'UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, tags = ?, category_id = ?, status = ?, archived = ?, update_time = ? WHERE id = ?',
      [title.slice(0, 200), slug.slice(0, 200), content, excerpt, tags.slice(0, 255), categoryId, status, archived, time, id]
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
    if (!id) return error('缺少文章 ID。', 400);
    await db.run('DELETE FROM posts WHERE id = ?', [id]);
    return json({ ok: true });
  } catch (e) {
    return error(e.message || '删除失败。', 500);
  }
}
