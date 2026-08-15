// 文件：functions/_middleware.js
// 全局中间件 — 参考 Cloudflare Pages Functions 官方 _middleware 规范。
// 文档：https://developers.cloudflare.com/pages/functions/middleware/
//
// 职责（按链顺序执行）：
//   1) OPTIONS 预检统一拦截（业务函数不再各自写 onRequestOptions）
//   2) 注入 X-Request-Id（便于排障，从 CF 的 cf-ray 头兜底）
//   3) 调用下游 context.next()
//   4) 给响应补齐 CORS + 安全头（业务函数响应头会被覆盖一层）
//   5) 结构化访问日志

import { cors, securityHeaders } from './_lib/http.js';

/* 生成短请求 ID（兜底，cf-ray 通常已存在） */
function genReqId(request) {
  const cfRay = request.headers.get('cf-ray');
  if (cfRay) return cfRay;
  return Math.random().toString(36).slice(2, 10);
}

export async function onRequest(context) {
  const { request } = context;
  const method = request.method;
  const url = new URL(request.url);
  const reqId = genReqId(request);

  // 1) CORS 预检统一处理
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...cors, 'X-Request-Id': reqId },
    });
  }

  // 2) 调用下游
  let response;
  try {
    response = await context.next();
  } catch (e) {
    console.error('[middleware] downstream error:', e);
    return new Response(JSON.stringify({ error: e?.message || '服务器内部错误。', code: 'INTERNAL', status: 500 }), {
      status: 500,
      headers: { ...cors, ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'X-Request-Id': reqId },
    });
  }

  // 3) 给响应补齐头（业务函数的响应头会被覆盖一层，保证一致）
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  for (const [k, v] of Object.entries(securityHeaders)) headers.set(k, v);
  headers.set('X-Request-Id', reqId);

  // 4) 结构化日志（CF Pages 日志面板可见）
  console.log(JSON.stringify({
    t: new Date().toISOString(),
    lvl: 'info',
    method,
    path: url.pathname,
    status: response.status,
    rid: reqId,
  }));

  // 用相同 body + 新头返回
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
