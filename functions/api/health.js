// 文件：functions/api/health.js — 适配器探针：验证 db.all/first/run/batch 全部方法
// 路由：GET /api/health
import { createDb } from '../_lib/db.js';
import { json } from '../_lib/http.js';

export async function onRequestGet({ env }) {
  const result = { driver: null, all: null, first: null, run: null, batch: null, error: null };
  try {
    const db = createDb(env);
    result.driver = db.driver;
    result.all = await db.all('SELECT 1 AS v');
    result.first = await db.first('SELECT 1 AS v', [], 'v');
    result.run = (await db.run('SELECT 1')).success;
    const batched = await db.batch([{ sql: 'SELECT 1 AS a' }, { sql: 'SELECT 2 AS b' }]);
    result.batch = Array.isArray(batched) && batched.length === 2;
  } catch (e) {
    result.error = e.message;
  }
  return json(result);
}
