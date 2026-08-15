// 文件：functions/_lib/auth.js
// 统一鉴权：参考 Cloudflare 推荐做法
//   1) env.ADMIN_PASSWORD 必须配置，否则 500
//   2) 三种取值优先级：Authorization Bearer > X-Admin-Password header > query.password
//   3) requireAdmin() 保持同步 API（兼容现有调用方）
//   4) withAuth(handler) 中间件用 timing-safe 比较，防时序攻击
// 文档：https://developers.cloudflare.com/pages/functions/api-reference/#middleware

import { error } from './http.js';

/* ============ 常量 ============ */
export const AUTH_HEADER = 'X-Admin-Password';
const ENV_KEY = 'ADMIN_PASSWORD';

/* ============ 密码提取 ============ */
// 优先级：Authorization: Bearer <pwd> > X-Admin-Password > query.password
// 保留 query 兼容历史前端代码，但不推荐（密码会进 CF 访问日志）
export function extractPassword(request) {
  // 1. Authorization: Bearer xxx
  const authz = request.headers.get('Authorization') || '';
  if (authz.toLowerCase().startsWith('bearer ')) {
    const v = authz.slice(7).trim();
    if (v) return v;
  }
  // 2. X-Admin-Password（推荐前端用此 header）
  const fromHeader = request.headers.get(AUTH_HEADER);
  if (fromHeader) return fromHeader;
  // 3. query.password（兜底兼容）
  try {
    return new URL(request.url).searchParams.get('password') || null;
  } catch {
    return null;
  }
}

/* ============ 鉴权核心（同步）============ */
// 返回 { ok, response? }：ok=false 时 response 为 401/500，直接 return。
// 同步 API，兼容现有调用方：const auth = requireAdmin(env, password); if (!auth.ok) return auth.response;
export function requireAdmin(env, password) {
  if (!env || !env[ENV_KEY]) {
    return { ok: false, response: error('服务器未配置管理员密码（ADMIN_PASSWORD）。', 500, 'AUTH_NOT_CONFIGURED') };
  }
  if (!password || String(password) !== String(env[ENV_KEY])) {
    return { ok: false, response: error('管理员密码错误。', 401, 'AUTH_INVALID') };
  }
  return { ok: true };
}

/* ============ timing-safe 比较（异步）============ */
// 用 SHA-256 把两边密码哈希成等长缓冲再比较，避免直接 === 导致时序泄漏。
// 仅在 withAuth 中间件使用，避免破坏现有同步 API。
async function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a || '')),
    crypto.subtle.digest('SHA-256', enc.encode(b || '')),
  ]);
  const da = new Uint8Array(ha), db = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
  return diff === 0;
}

/* ============ 中间件包装器 ============ */
// 用法：export const onRequestPost = withAuth(async ({ env, request }) => { ... });
// 鉴权通过才执行 handler，否则自动返回 401/500。
// 异步用 timing-safe 比较，防时序攻击。
export function withAuth(handler) {
  return async (ctx) => {
    if (!ctx.env || !ctx.env[ENV_KEY]) {
      return error('服务器未配置管理员密码（ADMIN_PASSWORD）。', 500, 'AUTH_NOT_CONFIGURED');
    }
    const password = extractPassword(ctx.request);
    const valid = await timingSafeEqualStr(String(password || ''), String(ctx.env[ENV_KEY]));
    if (!password || !valid) {
      return error('管理员密码错误。', 401, 'AUTH_INVALID');
    }
    return handler(ctx);
  };
}
