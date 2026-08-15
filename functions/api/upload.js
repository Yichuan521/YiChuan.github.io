// 文件：functions/api/upload.js — 图床接口（统一素材管理：图片/文档/附件）
// POST   /api/upload            multipart/form-data 上传，字段名 file
// GET    /api/upload            列表（支持 ?mime=image | ?q= 搜索 filename）
// GET    /api/upload?id=N       单条元数据
// DELETE /api/upload?id=N       删除（同时从 R2 删除对象）
// 鉴权：所有写操作需 X-Admin-Password。读列表公开（让前端图床选择器浏览）
import { createDb } from '../_lib/db.js';
import { createStorage } from '../_lib/storage.js';
import { requireAdmin, extractPassword } from '../_lib/auth.js';
import { json, error } from '../_lib/http.js';

// 允许的文件类型白名单（按大类）。前端在编辑器里也做客户端预检
const ALLOWED = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/avif'],
  doc:   ['application/pdf', 'application/zip', 'application/x-zip-compressed',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain', 'text/markdown', 'application/json'],
};
const ALL_ALLOWED = [...ALLOWED.image, ...ALLOWED.doc];

// 单文件上限：25 MB（Cloudflare Workers 单请求 100MB 上限，留余地）
const MAX_SIZE = 25 * 1024 * 1024;

// 根据 MIME 推断大类
function classifyMime(mime) {
  if (ALLOWED.image.includes(mime)) return 'image';
  if (ALLOWED.doc.includes(mime)) return 'doc';
  return null;
}

// 生成 R2 key：日期目录 + 防止重名
function makeKey(filename, mime) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const safe = (filename || 'file').replace(/[^\w.\-]+/g, '_').slice(-100);
  const ext = (mime && mime.startsWith('image/')) ? ('.' + mime.split('/')[1].replace('svg+xml', 'svg').replace('jpeg', 'jpg')) : '';
  const rand = Math.random().toString(36).slice(2, 8);
  return `uploads/${y}/${m}${d}/${Date.now()}-${rand}-${safe}${ext && !safe.toLowerCase().endsWith(ext) ? ext : ''}`;
}

// 从图片字节解析宽高（仅 PNG / JPEG / GIF / WebP，最小实现）
function parseImageSize(buf, mime) {
  try {
    const u8 = new Uint8Array(buf);
    if (mime === 'image/png' && u8.length >= 24) {
      return { width: (u8[16] << 24 | u8[17] << 16 | u8[18] << 8 | u8[19]) >>> 0,
               height: (u8[20] << 24 | u8[21] << 16 | u8[22] << 8 | u8[23]) >>> 0 };
    }
    if (mime === 'image/jpeg') {
      let i = 2;
      while (i < u8.length) {
        if (u8[i] !== 0xFF) break;
        const marker = u8[i + 1];
        const len = (u8[i + 2] << 8 | u8[i + 3]);
        if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          return { height: (u8[i + 5] << 8 | u8[i + 6]) >>> 0, width: (u8[i + 7] << 8 | u8[i + 8]) >>> 0 };
        }
        i += 2 + len;
      }
    }
    if (mime === 'image/gif' && u8.length >= 10) {
      return { width: (u8[7] << 8 | u8[6]) >>> 0, height: (u8[9] << 8 | u8[8]) >>> 0 };
    }
    if (mime === 'image/webp' && u8.length >= 30) {
      // 简化：VP8/VP8L/VP8X 三种 chunk 起始不同，这里仅取最常见 VP8 路径
      if (u8[12] === 0x56 && u8[13] === 0x50 && u8[14] === 0x38 && u8[15] === 0x20) {
        return { width: ((u8[26] | (u8[27] << 8)) & 0x3FFF) >>> 0,
                 height: ((u8[28] | (u8[29] << 8)) & 0x3FFF) >>> 0 };
      }
    }
  } catch { /* ignore */ }
  return null;
}

export async function onRequestGet({ env, request }) {
  const db = createDb(env);
  try {
    const u = new URL(request.url);
    const id = u.searchParams.get('id');
    if (id) {
      const row = await db.first('SELECT * FROM assets WHERE id = ?', [Number(id)]);
      if (!row) return error('资源不存在。', 404);
      return json({ asset: row });
    }

    const where = [];
    const params = [];
    const mimeFilter = u.searchParams.get('mime');     // image | doc
    const q = u.searchParams.get('q');
    if (mimeFilter === 'image') {
      where.push('mime LIKE ?'); params.push('image/%');
    } else if (mimeFilter === 'doc') {
      where.push('mime NOT LIKE ?'); params.push('image/%');
    }
    if (q) { where.push('filename LIKE ?'); params.push(`%${q}%`); }

    const sql = `SELECT * FROM assets ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY uploaded_at DESC`;
    const rows = await db.all(sql, params);
    return json({ assets: rows });
  } catch (e) {
    return error(e.message || '查询失败。', 500);
  }
}

export async function onRequestPost({ env, request }) {
  const db = createDb(env);
  // 鉴权（先做，避免浪费上传时间）
  const password = extractPassword(request);
  const auth = requireAdmin(env, password);
  if (!auth.ok) return auth.response;

  let storage;
  try { storage = createStorage(env); }
  catch (e) { return error(e.message || '存储未配置。', 500); }

  if (storage.mode !== 'r2') {
    return error('图床上传未启用：未绑定 R2_BUCKET。请在 Cloudflare Pages 配置 R2 绑定后重试。', 400);
  }

  let formData;
  try { formData = await request.formData(); }
  catch { return error('请求必须是 multipart/form-data。', 400); }

  const file = formData.get('file');
  if (!file || typeof file === 'string') return error('未提供文件，字段名需为 file。', 400);

  // file 是 File 对象：有 name / type / size / arrayBuffer()
  const filename = file.name || 'upload.bin';
  const mime = (file.type || 'application/octet-stream').toLowerCase();
  const size = file.size || 0;

  if (size > MAX_SIZE) return error(`文件过大（${(size / 1024 / 1024).toFixed(2)} MB），上限 25 MB。`, 400);
  if (!ALL_ALLOWED.includes(mime)) {
    return error(`不支持的文件类型：${mime}。仅支持图片与常见文档/压缩包。`, 400);
  }

  const buf = await file.arrayBuffer();
  const key = makeKey(filename, mime);

  try {
    const url = await storage.put(key, buf, mime);
    let width = null, height = null;
    if (mime.startsWith('image/')) {
      const dim = parseImageSize(buf, mime);
      if (dim) { width = dim.width; height = dim.height; }
    }
    const now = Math.floor(Date.now() / 1000);
    // 若 R2 未配 public base，url 为 null，则前端无法直接 <img src=...>；记录里 url 字段写 null
    await db.run(
      `INSERT INTO assets (key, url, filename, size, mime, width, height, source, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'r2', ?)`,
      [key, url || '', filename, size, mime, width, height, now]
    );
    return json({
      ok: true,
      asset: {
        key, url: url || null, filename, size, mime, width, height,
        source: 'r2', uploaded_at: now,
      },
    });
  } catch (e) {
    // 上传失败：尝试清理已写入的对象（半成功）
    try { await storage.del(key); } catch {}
    return error(e.message || '上传失败。', 500);
  }
}

// 外链登记（无文件上传，仅写一条记录到 assets 表）
export async function onRequestPut({ env, request }) {
  const db = createDb(env);
  const password = extractPassword(request);
  const auth = requireAdmin(env, password);
  if (!auth.ok) return auth.response;

  let body;
  try { body = await request.json(); } catch { return error('请求体格式错误。', 400); }

  const url = (body.url || '').toString().trim();
  const filename = (body.filename || '').toString().trim();
  const mime = (body.mime || 'image/external').toString().trim();
  const width = body.width ? Number(body.width) : null;
  const height = body.height ? Number(body.height) : null;
  const size = body.size ? Number(body.size) : null;
  if (!url) return error('URL 不能为空。', 400);

  const now = Math.floor(Date.now() / 1000);
  await db.run(
    `INSERT INTO assets (key, url, filename, size, mime, width, height, source, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'external', ?)`,
    [url, url, filename || url.split('/').pop() || 'external', size, mime, width, height, now]
  );
  return json({ ok: true });
}

export async function onRequestDelete({ env, request }) {
  const db = createDb(env);
  const password = extractPassword(request);
  const auth = requireAdmin(env, password);
  if (!auth.ok) return auth.response;

  const u = new URL(request.url);
  const id = u.searchParams.get('id');
  if (!id) return error('缺少 asset ID。', 400);

  const row = await db.first('SELECT key, source FROM assets WHERE id = ?', [Number(id)]);
  if (!row) return error('资源不存在。', 404);

  // R2 模式同步删除对象
  if (row.source === 'r2' && row.key) {
    try {
      const storage = createStorage(env);
      if (storage.mode === 'r2') await storage.del(row.key);
    } catch { /* 不阻断 DB 删除 */ }
  }
  await db.run('DELETE FROM assets WHERE id = ?', [Number(id)]);
  return json({ ok: true });
}
