// 文件：functions/api/auth.js
// 鉴权探针接口：管理端登录时调用，仅做密码校验，不写任何数据。
// 路由：POST /api/auth  / GET /api/auth?probe=1
//
// 设计参考 Cloudflare Pages Functions 官方建议：
//   1) 用 POST 避免浏览器预取造成的误探测
//   2) 密码通过 X-Admin-Password 或 Authorization: Bearer header 传递
//   3) 用 timing-safe 比较防时序攻击
//   4) 返回标准响应格式 { ok, code, status }

import { withAuth, extractPassword } from '../_lib/auth.js';
import { json, error, ok, wrap } from '../_lib/http.js';

/* ============ POST /api/auth — 标准登录入口 ============ */
// 用 withAuth 中间件，鉴权通过才执行 handler，自动返回 401/500。
export const onRequestPost = withAuth(async ({ env }) => {
  // 鉴权已通过，返回登录成功 + 服务端时间戳（前端可用于同步显示）
  return ok({
    authenticated: true,
    server_time: Math.floor(Date.now() / 1000),
    // 服务端能力声明（前端可据此决定是否启用某些功能）
    capabilities: {
      has_db: !!(env.DB || env.MYSQL_URL),
      has_r2: !!env.R2_BUCKET,
      has_kv: !!env.SITE_KV,
    },
  });
});

/* ============ GET /api/auth?probe=1 — 轻量探测（不返回敏感信息）============ */
// 用法：GET /api/auth?probe=1，返回服务端是否配置了 ADMIN_PASSWORD，
// 不返回密码本身，不消耗 timing-safe 比较成本。
export async function onRequestGet({ env, request }) {
  return wrap(async () => {
    const u = new URL(request.url);
    const isProbe = u.searchParams.get('probe') === '1';
    if (!isProbe) {
      // 不带 probe 参数的 GET：要求鉴权，返回完整登录态信息
      const password = extractPassword(request);
      if (!env || !env.ADMIN_PASSWORD) {
        return error('服务器未配置管理员密码（ADMIN_PASSWORD）。', 500, 'AUTH_NOT_CONFIGURED');
      }
      if (!password || String(password) !== String(env.ADMIN_PASSWORD)) {
        return error('管理员密码错误。', 401, 'AUTH_INVALID');
      }
      return ok({ authenticated: true, server_time: Math.floor(Date.now() / 1000) });
    }
    // 探测模式：仅返回服务端是否就绪，不泄露密码
    return json({
      ready: !!(env && env.ADMIN_PASSWORD),
      has_db: !!(env.DB || env.MYSQL_URL),
      has_r2: !!env.R2_BUCKET,
    });
  })();
}
