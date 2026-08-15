// 文件：functions/_lib/db.js — 数据访问层抽象
// 对外统一 API：all / first / run / batch。内部按 env.DB_DRIVER 切换驱动。
// 当前实现 D1 驱动（完整），MySQL 驱动接口已锁、实现留 TODO（迁移时填）。
//
// SQL 方言策略：业务 SQL 写方言中立子集
//   - 占位符统一用 ?（D1 与 MySQL 都支持）
//   - 时间戳由 JS 算好 Math.floor(Date.now()/1000) 作为 bind 参数传入，不写 unixepoch()/UNIX_TIMESTAMP()
//   - 新表列名避开保留字（desc -> description），方言差异只出现在 schema/*.sql 两份 DDL

export function createDb(env) {
  const driver = (env.DB_DRIVER || 'd1').toLowerCase();
  if (driver === 'd1') return createD1Driver(env);
  if (driver === 'mysql') return createMysqlDriver(env);
  throw new Error(`Unknown DB_DRIVER: ${driver}`);
}

// D1 驱动（完整实现）
function createD1Driver(env) {
  const prepare = (sql, params = []) => {
    const stmt = env.DB.prepare(sql);
    return params.length ? stmt.bind(...params) : stmt;
  };
  return {
    driver: 'd1',
    async all(sql, params = []) {
      const r = await prepare(sql, params).all();
      return r.results || [];
    },
    async first(sql, params = [], col) {
      const row = await prepare(sql, params).first();
      if (!row) return null;
      return col ? row[col] : row;
    },
    async run(sql, params = []) {
      const r = await prepare(sql, params).run();
      // meta.last_row_id: INSERT 自增 ID（D1）
      return { success: r.success, meta: r.meta, lastRowId: r.meta && r.meta.last_row_id };
    },
    // stmts: [{ sql, params }]，D1 batch 为原子
    async batch(stmts) {
      const prepared = stmts.map(s => {
        const p = env.DB.prepare(s.sql);
        return s.params && s.params.length ? p.bind(...s.params) : p;
      });
      return env.DB.batch(prepared);
    },
  };
}

// MySQL 驱动（占位，接口已锁）
// 迁移到服务器 MySQL 时实现。
// 关键约束：Cloudflare Workers 运行时禁止原生 TCP，不能直接用 mysql2 包。
// 必须走 HTTP 通道，三选一：
//   a) PlanetScale @planetscale/database 的 fetch 模式
//   b) Cloudflare Hyperdrive + 外部 MySQL
//   c) 自建 HTTP 网关（推荐：部署一个 /db-gateway Worker 到能跑 TCP 的环境，本驱动用 fetch 调它）
// 配置：env.MYSQL_HTTP_URL / env.MYSQL_TOKEN
function createMysqlDriver(env) {
  throw new Error('MySQL driver not implemented. Set DB_DRIVER=d1 for now.');
  // 实现后签名与 D1 驱动一致：
  // return { driver: 'mysql', all, first, run, batch };
}
