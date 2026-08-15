// 文件：functions/_lib/http.js
// 标准 HTTP 工具：基于 Cloudflare Workers Runtime 原生 Response.json() 实现。
// 参考：
//   https://developers.cloudflare.com/pages/functions/api-reference/#context
// 所有 API 共用，提供：CORS、安全头、JSON 响应、统一错误格式、链式中间件工具。

/* ============ 响应头 ============ */
// CORS：跨域开放（CF Pages 部署后同源访问也兼容）。
// 安全头：HSTS / X-Content-Type-Options / Referrer-Policy（CF 官方推荐基线）。
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  // X-Admin-Password：管理端鉴权 header；Content-Type：JSON body
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, Authorization',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': 'X-Request-Id',
};

export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

// 合并 CORS + 安全头 + 业务自定义头
function buildHeaders(extra = {}) {
  return { ...cors, ...securityHeaders, ...extra };
}

/* ============ JSON 响应 ============ */
// 用 Response.json() 静态方法（CF Workers Runtime 原生支持），统一加 CORS + 安全头
export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: buildHeaders({ 'Content-Type': 'application/json; charset=utf-8', ...extra }),
  });
}

// 错误响应：统一格式 { error, code, status }
export function error(message, status = 400, code = 'ERR') {
  return json({ error: message, code, status }, status);
}

// 成功响应：统一格式 { ok: true, ...data }
export function ok(extra = {}) {
  return json({ ok: true, ...extra });
}

/* ============ 工具函数 ============ */
// 从 URL 解析 query（容错）
export function parseQuery(request) {
  try { return new URL(request.url).searchParams; }
  catch { return new URLSearchParams(''); }
}

// 安全解析 JSON body（容错，返回 { ok, data, error }）
export async function parseJsonBody(request) {
  try {
    const data = await request.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: '请求体格式错误。' };
  }
}

// 统一异常捕获包装器：handler 抛错时自动返回 500 + 错误信息
// 用法：export const onRequestGet = wrap(async ({ env, request }) => { ... });
export function wrap(handler) {
  return async (context) => {
    try {
      return await handler(context);
    } catch (e) {
      console.error('[handler] uncaught:', e);
      return error(e && e.message ? e.message : '服务器内部错误。', 500, 'INTERNAL');
    }
  };
}
