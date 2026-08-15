// 文件：functions/api/count.js — 访问计数接口（KV: KV_COUNT，迁移到 _lib/http，逻辑不变）
import { json } from '../_lib/http.js';

function todayKey() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `today:${y}-${m}-${day}`;
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.KV_COUNT) return json({ total: 0, today: 0 }, 500);

    const url = new URL(request.url);
    const isRaw = url.searchParams.get('raw') === '1';
    const ip =
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For') ||
      'unknown';
    const ua = request.headers.get('User-Agent') || '';
    const isBot = /bot|spider|crawl|preview|headless/i.test(ua);
    const todayK = todayKey();

    // 总访问量
    let total = 0;
    const totalEntry = await env.KV_COUNT.getWithMetadata('total');
    if (totalEntry && totalEntry.value != null) total = Number(totalEntry.value) || 0;

    // 今日 UV + PV
    let todayPv = 0;
    let todayUv = 0;
    const todayEntry = await env.KV_COUNT.getWithMetadata(todayK);
    if (todayEntry && todayEntry.value != null) todayPv = Number(todayEntry.value) || 0;
    const todayMeta = (todayEntry && todayEntry.metadata) || {};
    const ips = Array.isArray(todayMeta.ips) ? todayMeta.ips : [];
    todayUv = ips.length;

    // raw=1 表示只读刷新（前端 30 秒轮询），不增加计数
    if (!isRaw && !isBot) {
      total += 1;
      todayPv += 1;
      if (!ips.includes(ip)) {
        ips.push(ip);
        if (ips.length > 2000) ips.splice(0, ips.length - 2000);
        todayUv = ips.length;
      }
      await Promise.all([
        env.KV_COUNT.put('total', String(total)),
        env.KV_COUNT.put(todayK, String(todayPv), { metadata: { ips } }),
      ]);
    }

    return json({ total, today: todayPv, today_uv: todayUv });
  } catch (e) {
    return json({ total: 0, today: 0, error: e.message }, 500);
  }
}
