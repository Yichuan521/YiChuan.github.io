// 文件：functions/_lib/storage.js — 文件存储抽象
// env.R2_BUCKET 存在时用 R2 驱动（真上传），否则降级为外链驱动（只存 URL）。
// storage.mode 暴露给前端，决定资源管理 UI 显示「上传」还是「仅外链」。

export function createStorage(env) {
  if (env.R2_BUCKET) return createR2Driver(env);
  return createExternalLinkDriver();
}

function createR2Driver(env) {
  const bucket = env.R2_BUCKET;
  // 自定义域名或 r2.dev 公开基址
  const publicBase = (env.R2_PUBLIC_BASE || '').replace(/\/$/, '');
  return {
    mode: 'r2',
    async put(key, body, contentType) {
      await bucket.put(key, body, { httpMetadata: { contentType } });
      return this.url(key);
    },
    async get(key) {
      return bucket.get(key);
    },
    async del(key) {
      await bucket.delete(key);
    },
    async list(prefix = '') {
      const r = await bucket.list({ prefix });
      return (r.objects || []).map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded }));
    },
    // 若未配置公开基址则返回 null（前端需用资源接口代理下载）
    url(key) {
      return publicBase ? `${publicBase}/${key}` : null;
    },
  };
}

function createExternalLinkDriver() {
  return {
    mode: 'external',
    // 外链模式不支持上传，调用方应走 JSON {url} 而非 multipart
    put() {
      throw new Error('R2 未绑定，文件存储未启用。请改用外链模式，或配置 R2_BUCKET 绑定。');
    },
    get() { return null; },
    del() {},
    list() { return []; },
    // 外链模式：资源记录直接存完整 URL，key 即 URL
    url(key) { return key; },
  };
}
