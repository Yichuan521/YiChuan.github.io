// 文件：assets/js/main.js
const $ = (selector) => document.querySelector(selector);
const api = '/api';
const projectData = [
  { id:1, title:'个人数字花园', desc:'一个强调内容层级、留白与微交互的原生个人网站。', tags:['HTML','CSS','JavaScript'], groups:['frontend','design'], cover:'cover-a' },
  { id:2, title:'边缘留言板', desc:'基于 Cloudflare Pages Functions、D1 与 KV 的轻量互动留言应用。', tags:['Cloudflare','Pages','D1','KV'], groups:['cloudflare','frontend'], cover:'cover-b' },
  { id:3, title:'界面组件实验', desc:'针对个人产品梳理的视觉 Token、无障碍状态与组件设计系统。', tags:['Design','UI','A11y'], groups:['design'], cover:'cover-c' },
  { id:4, title:'阅读记录工具', desc:'用于记录进度、摘录与阅读想法的离线优先前端小工具。', tags:['JavaScript','LocalStorage','Frontend'], groups:['frontend'], cover:'cover-d' }
];

document.querySelectorAll('.current-year').forEach((node) => node.textContent = new Date().getFullYear());
const savedTheme = localStorage.getItem('site-theme');
if (savedTheme) document.body.classList.add(savedTheme);
$('.theme-button')?.addEventListener('click', () => { const dark = document.body.classList.toggle('dark'); document.body.classList.toggle('light', !dark); localStorage.setItem('site-theme', dark ? 'dark' : 'light'); });
const currentPage = document.body.dataset.page;
const navTarget = currentPage === 'home' ? 'index' : (currentPage === 'article' ? 'articles' : currentPage);
document.querySelector(`.site-nav a[href="${navTarget}.html"]`)?.classList.add('active');
const menuButton = $('.menu-button'), nav = $('.site-nav');
menuButton?.addEventListener('click', () => { const open = nav.classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(open)); });

// 全局搜索：只将关键词带到项目页，不调用任何网络搜索服务。
const dialog = $('#searchDialog'), globalInput = $('#globalSearchInput');
function openGlobalSearch() { dialog?.classList.add('open'); dialog?.setAttribute('aria-hidden','false'); setTimeout(() => globalInput?.focus(), 0); }
function closeGlobalSearch() { dialog?.classList.remove('open'); dialog?.setAttribute('aria-hidden','true'); }
$('.search-button')?.addEventListener('click', openGlobalSearch);
$('#clearGlobalSearch')?.addEventListener('click', () => { globalInput.value = ''; globalInput.focus(); });
globalInput?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { const term = globalInput.value.trim(); location.href = `projects.html${term ? `?q=${encodeURIComponent(term)}` : ''}`; } });
document.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openGlobalSearch(); } if (event.key === 'Escape') { if (dialog?.classList.contains('open')) closeGlobalSearch(); document.querySelectorAll('input[type="search"]').forEach((input) => { input.value = ''; input.dispatchEvent(new Event('input')); }); } });
dialog?.addEventListener('click', (event) => { if (event.target === dialog) closeGlobalSearch(); });

function debounce(fn, delay = 300) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; }
function terms(value) { return value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean); }
function matchText(item, query) { const words = terms(query); const title = item.title.toLowerCase(); const other = `${item.desc} ${item.tags.join(' ')}`.toLowerCase(); return words.every((word) => title.includes(word) || other.includes(word)); }
function projectCard(item) { return `<article class="project-card"><div class="cover ${item.cover}"><small>0${item.id}</small><span>${item.tags[0].toUpperCase()}</span></div><div class="card-content"><h3>${item.title}</h3><p>${item.desc}</p><div class="tag-row">${item.tags.map(tag => `<span>${tag}</span>`).join('')}</div><div class="card-links"><a href="https://github.com/你的GitHub用户名" target="_blank" rel="noreferrer">源码 ↗</a><a href="#" aria-label="请替换项目演示链接">演示 ↗</a></div></div></article>`; }
function initProjects() { const list = $('#projectList'); if (!list) return; const search = $('#projectSearch'), summary = $('#projectSummary'), empty = $('#projectEmpty'); let filter = 'all';
  const render = () => { const q = search.value; const results = projectData.filter(item => (filter === 'all' || item.groups.includes(filter)) && matchText(item, q)).sort((a,b) => Number(!a.title.toLowerCase().includes(q.toLowerCase())) - Number(!b.title.toLowerCase().includes(q.toLowerCase()))); list.innerHTML = results.map(projectCard).join(''); empty.hidden = results.length > 0; summary.textContent = q || filter !== 'all' ? `找到 ${results.length} 个匹配项目` : `共 ${results.length} 个项目`; };
  const initial = new URLSearchParams(location.search).get('q'); if (initial) search.value = initial; render();
  search.addEventListener('input', debounce(render)); $('#clearProjectSearch').addEventListener('click', () => { search.value = ''; render(); search.focus(); });
  $('#projectFilters').addEventListener('click', (event) => { const button = event.target.closest('button'); if (!button) return; filter = button.dataset.filter; document.querySelectorAll('#projectFilters button').forEach(node => node.classList.toggle('active', node === button)); render(); });
}

async function loadCount(raw = false) {
  const target = $('#visitCount') || $('#visitTotal'); if (!target) return;
  const fmt = (n) => new Intl.NumberFormat('zh-CN').format(Number(n) || 0);
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const elDate = $('#visitDate'); if (elDate) elDate.textContent = dateStr;
  try {
    const response = await fetch(`${api}/count${raw ? '?raw=1' : ''}`), data = await response.json();
    if (!response.ok) throw new Error();
    target.textContent = fmt(data.total);
    const elToday = $('#visitToday'); if (elToday) elToday.textContent = fmt(data.today);
  } catch {
    target.textContent = '—';
    const elToday = $('#visitToday'); if (elToday) elToday.textContent = '—';
  }
}
/* 访问人数实时同步：首次加载计数+1，之后每30秒只读刷新，页面不可见时暂停 */
function initCountRealtime() {
  const target = $('#visitCount') || $('#visitTotal'); if (!target) return;
  let countTimer = null;
  const start = () => { stop(); countTimer = setInterval(() => loadCount(true), 30000); };
  const stop = () => { if (countTimer) clearInterval(countTimer); countTimer = null; };
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
  start();
}
const escapeHtml = (text) => String(text).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;' })[char]);
function formatDate(t) {
  const d = new Date(Number(t) * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/* Markdown 渲染：B 站短码 @[bilibili](BV1xx) 预处理 → marked 解析 → DOMPurify 消毒 → 占位替换 iframe */
function renderMarkdown(md, container) {
  if (!md) { container.innerHTML = '<p>暂无内容</p>'; return; }
  // 1. B 站短码 → 占位 div（marked 会原样保留块级 HTML）
  let processed = md.replace(/@\[bilibili\]\(\s*(https?:\/\/www\.bilibili\.com\/video\/(BV[\w]+)[^)\s]*|BV[\w]+)\s*\)/gi, (_m, g1, g2) => {
    const bvid = g2 || g1;
    return `\n<div class="bili-embed" data-bvid="${bvid}"></div>\n`;
  });
  // 2. marked 解析（无 marked 时退化为纯文本）
  let html;
  if (window.marked) {
    try { html = window.marked.parse(processed); } catch { html = `<pre>${escapeHtml(processed)}</pre>`; }
  } else {
    html = `<pre>${escapeHtml(processed)}</pre>`;
  }
  // 3. DOMPurify 消毒（防 XSS，清除 script/onerror 等）
  if (window.DOMPurify) html = window.DOMPurify.sanitize(html);
  container.innerHTML = html;
  // 4. 占位 div → iframe（绕过 DOMPurify 对 iframe 的默认拦截，仅允许 B 站官方播放器域名）
  container.querySelectorAll('.bili-embed').forEach((el) => {
    const bvid = el.getAttribute('data-bvid') || '';
    if (!/^BV[\w]+$/i.test(bvid)) { el.remove(); return; }
    const iframe = document.createElement('iframe');
    iframe.src = `https://player.bilibili.com/player.html?bvid=${bvid}&high_quality=1&autoplay=0`;
    iframe.className = 'bili-iframe';
    iframe.loading = 'lazy';
    iframe.allowFullscreen = true;
    iframe.setAttribute('allow', 'accelerometer; autoplay; encrypted-media; picture-in-picture');
    el.replaceWith(iframe);
  });
}
function toast(message) { const box = $('#toast'); if (!box) return; box.textContent = message; box.classList.add('show'); setTimeout(() => box.classList.remove('show'), 2200); }
async function loadGuestbook() {
  const list = $('#guestbookList'); if (!list) return;
  try {
    const response = await fetch(`${api}/guestbook`), data = await response.json();
    if (!response.ok) throw new Error();
    $('#messageNumber').textContent = `${data.messages.length} 条`;
    if (!data.messages.length) {
      list.innerHTML = '<p class="form-message">还没有留言，来做第一个吧。</p>'; return;
    }
    list.innerHTML = data.messages.map(item => {
      const repliesHtml = item.replies && item.replies.length
        ? `<div class="reply-toggle" data-id="${item.id}">展开 ${item.replies.length} 条回复</div>
           <div class="reply-thread" data-thread="${item.id}" style="display:none">
             ${item.replies.map(r => `<div class="reply-item">
               <div class="reply-meta">
                 <strong>${escapeHtml(r.nickname)}</strong>
                 <time>${new Date(r.time * 1000).toLocaleString('zh-CN')}</time>
               </div>
               ${r.email ? `<div class="message-email-row">${escapeHtml(r.email)}</div>` : ''}
               <p>${escapeHtml(r.content)}</p>
             </div>`).join('')}
           </div>`
        : '';
      return `<article class="message-item" data-id="${item.id}">
        <div class="message-meta">
          <strong>${escapeHtml(item.nickname)}</strong>
          <time>${new Date(item.time * 1000).toLocaleString('zh-CN')}</time>
        </div>
        ${item.email ? `<div class="message-email-row">${escapeHtml(item.email)}</div>` : ''}
        <p>${escapeHtml(item.content)}</p>
        <div class="message-actions">
          <button type="button" class="reply-btn" data-id="${item.id}">回复</button>
        </div>
        ${repliesHtml}
      </article>`;
    }).join('');
    bindGuestbookInteractions();
  } catch { list.innerHTML = '<p class="form-message">留言暂时无法加载，请稍后再试。</p>'; }
}
function bindGuestbookInteractions() {
  document.querySelectorAll('.reply-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const thread = document.querySelector(`.reply-thread[data-thread="${id}"]`);
      if (!thread) return;
      const expanded = thread.style.display === 'block';
      thread.style.display = expanded ? 'none' : 'block';
      btn.classList.toggle('expanded', !expanded);
      btn.textContent = expanded ? `展开 ${thread.children.length} 条回复` : `收起 ${thread.children.length} 条回复`;
    });
  });
  document.querySelectorAll('.reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const form = $('#guestbookForm');
      const contentField = form.querySelector('textarea[name="content"]');
      const submitBtn = form.querySelector('button[type="submit"]');
      const replyField = form.querySelector('input[name="reply_to"]');
      if (!replyField) {
        const input = document.createElement('input');
        input.type = 'hidden'; input.name = 'reply_to'; input.value = id;
        form.appendChild(input);
      } else { replyField.value = id; }
      contentField.focus();
      window.scrollTo({ top: form.offsetTop - 80, behavior: 'smooth' });
      submitBtn.innerHTML = '回复留言 <b>→</b>';
      const status = $('#guestbookStatus');
      status.textContent = `正在回复留言 #${id}，发布后将自动归类到该留言下。`;
    });
  });
}
const messageInput = $('#guestbookForm textarea');
messageInput?.addEventListener('input', () => $('#messageLength').textContent = `${messageInput.value.length} / 300`);
$('#guestbookForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget, button = form.querySelector('button'), status = $('#guestbookStatus');
  const body = Object.fromEntries(new FormData(form));
  const isReply = body.reply_to;
  if (!body.nickname.trim() || !body.content.trim()) { status.textContent = '昵称和留言不能为空。'; return; }
  button.disabled = true; status.textContent = isReply ? '正在发布回复…' : '正在发布…';
  try {
    const response = await fetch(`${api}/guestbook`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }), data = await response.json();
    if (!response.ok) throw new Error(data.error);
    form.reset();
    $('#messageLength').textContent = '0 / 300';
    const replyField = form.querySelector('input[name="reply_to"]');
    if (replyField) replyField.remove();
    button.innerHTML = '发布留言 <b>→</b>';
    status.textContent = isReply ? '回复已发布。' : '发布成功。';
    toast(isReply ? '回复已发布。' : '留言已发布，感谢你的来访。');
    loadGuestbook();
  } catch (error) { status.textContent = error.message || '发布失败，请稍后重试。'; }
  finally { button.disabled = false; }
});

function initFriends() { const list = $('#friendList'); if (!list) return; const input = $('#friendSearch'), summary = $('#friendSummary'); let data = [];
  const render = () => { const results = data.filter(item => { const text = `${item.name} ${item.desc}`.toLowerCase(); return terms(input.value).every(word => text.includes(word)); }); summary.textContent = input.value ? `找到 ${results.length} 个友链` : `共 ${results.length} 个友链`; list.innerHTML = results.length ? results.map(item => `<a class="friend-card" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer"><img class="friend-avatar" src="${escapeHtml(item.avatar)}" alt="" onerror="this.style.display='none'"><div><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.desc)}</p></div></a>`).join('') : '<div class="empty-state"><strong>⌕</strong><h2>没有匹配的友链</h2><p>换一个关键词试试。</p></div>'; };
  input.addEventListener('input', debounce(render)); $('#clearFriendSearch').addEventListener('click', () => { input.value = ''; render(); input.focus(); });
  $('#teleportButton')?.addEventListener('click', (event) => {
    const btn = event.currentTarget;
    btn.classList.remove('clicked'); void btn.offsetWidth; btn.classList.add('clicked');
    toast('正在穿越到随机站点…');
    setTimeout(() => { window.open('https://www.travellings.cn/go', '_blank', 'noopener,noreferrer'); }, 650);
  });
  fetch(`${api}/friends`).then(res => res.json()).then(result => { data = result.friends || []; render(); }).catch(() => { list.innerHTML = '<p class="form-message">友链暂时无法加载。</p>'; });
}

/* 小书翻页：首次自动播放一次，之后点击触发一次自动翻页 */
function initBook() {
  const book = $('#book'); if (!book) return;
  const total = 4; let current = 0; let autoTimer = null;
  const apply = () => {
    for (let i = 0; i < total; i++) book.classList.toggle(`flipping-${i}`, i < current);
    book.classList.toggle('playing', current > 0);
  };
  const stop = () => { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } };
  // 自动翻完一遍后回到封面停止
  const play = () => {
    stop();
    autoTimer = setInterval(() => {
      current++;
      apply();
      if (current >= total) {
        stop();
        setTimeout(() => { current = 0; apply(); }, 2500);
      }
    }, 3000);
  };
  // 点击：回到封面，重新自动翻一遍
  const restart = () => {
    stop();
    current = 0; apply();
    setTimeout(() => { current = 1; apply(); play(); }, 400);
  };
  book.addEventListener('click', restart);
  book.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); restart(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  setTimeout(play, 1200);
}
function initArticles() {
  const list = $('#articleList'); if (!list) return;
  const search = $('#articleSearch'), summary = $('#articleSummary'), empty = $('#articleEmpty');
  const filters = $('#articleFilters');
  const coverClasses = ['cover-a', 'cover-b', 'cover-c', 'cover-d'];
  let allPosts = [], filter = 'all';

  const render = () => {
    let results = allPosts;
    if (filter !== 'all') results = results.filter((p) => String(p.category_id) === filter);
    const q = search.value.trim();
    if (q) {
      const w = q.toLowerCase();
      results = results.filter((p) => (p.title || '').toLowerCase().includes(w) || (p.excerpt || '').toLowerCase().includes(w));
    }
    summary.textContent = (q || filter !== 'all') ? `找到 ${results.length} 篇文章` : `共 ${results.length} 篇文章`;
    empty.hidden = results.length > 0;
    list.innerHTML = results.map((p, i) => {
      const cover = coverClasses[i % coverClasses.length];
      const tagArr = p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      const tagHtml = tagArr.length ? `<div class="tag-row">${tagArr.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : '';
      const coverLabel = (tagArr[0] || p.title || 'ARTICLE').toUpperCase().slice(0, 8);
      return `<a class="article-card" href="article.html?slug=${encodeURIComponent(p.slug)}">
        <div class="cover ${cover}"><small>${String(p.id).padStart(2, '0')}</small><span>${escapeHtml(coverLabel)}</span></div>
        <div class="card-content">
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.excerpt || '')}</p>
          ${tagHtml}
          <div class="article-meta"><time>${formatDate(p.time)}</time>${p.category_name ? `<span class="article-cat">${escapeHtml(p.category_name)}</span>` : ''}<span>${p.views || 0} 阅读</span></div>
        </div>
      </a>`;
    }).join('');
  };

  // 分类筛选条
  fetch(`${api}/categories?type=post`).then((r) => r.json()).then((data) => {
    const cats = data.categories || [];
    filters.innerHTML = '<button class="active" data-filter="all">全部</button>' + cats.map((c) => `<button data-filter="${c.id}">${escapeHtml(c.name)}</button>`).join('');
  }).catch(() => {});

  const load = () => {
    list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
    fetch(`${api}/posts`).then((r) => r.json()).then((data) => {
      allPosts = data.posts || [];
      render();
    }).catch(() => { list.innerHTML = '<p class="form-message">文章暂时无法加载。</p>'; });
  };
  load();

  search.addEventListener('input', debounce(render));
  $('#clearArticleSearch')?.addEventListener('click', () => { search.value = ''; render(); search.focus(); });
  filters.addEventListener('click', (event) => {
    const btn = event.target.closest('button'); if (!btn) return;
    filter = btn.dataset.filter;
    filters.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });
}

async function loadArticleDetail() {
  const body = $('#articleBody'); if (!body) return;
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) { body.innerHTML = '<p class="form-message">缺少文章标识。</p>'; return; }
  try {
    const res = await fetch(`${api}/posts?slug=${encodeURIComponent(slug)}`), data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const p = data.post;
    document.title = `${p.title} · 义川先森`;
    const tags = p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    body.innerHTML = `
      <header class="article-header">
        <h1 class="article-title">${escapeHtml(p.title)}</h1>
        <div class="article-meta">
          <time>${formatDate(p.time)}</time>
          ${p.category ? `<span class="article-cat">${escapeHtml(p.category.name)}</span>` : ''}
          <span>${p.views || 0} 阅读</span>
          ${p.archived ? `<span class="article-archived">已归档</span>` : ''}
        </div>
        ${tags.length ? `<div class="tag-row">${tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </header>
      <div class="article-content" id="articleContent"></div>`;
    renderMarkdown(p.content, $('#articleContent'));
  } catch (err) {
    body.innerHTML = `<p class="form-message">${escapeHtml(err.message || '文章加载失败。')}</p>`;
  }
}

// 资源页：列表 + 搜索 + 分类筛选 + 归档切换
function formatBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}
function fileIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.startsWith('image/')) return '🖼';
  if (t.includes('pdf')) return '📕';
  if (t.includes('zip') || t.includes('rar') || t.includes('7z') || t.includes('tar') || t.includes('gz')) return '🗜';
  if (t.includes('word') || t.includes('msword')) return '📘';
  if (t.includes('excel') || t.includes('sheet')) return '📗';
  if (t.includes('presentation') || t.includes('powerpoint')) return '📙';
  if (t.includes('markdown') || t === 'text/plain' || t === 'application/json') return '📝';
  if (t.startsWith('audio/')) return '🎵';
  if (t.startsWith('video/')) return '🎬';
  if (t.startsWith('text/')) return '📄';
  return '📦';
}
function initResources() {
  const list = $('#resourceList'); if (!list) return;
  const search = $('#resourceSearch'), summary = $('#resourceSummary'), empty = $('#resourceEmpty');
  const filters = $('#resourceFilters');
  let allResources = [], filter = 'all';

  const render = () => {
    let results = allResources;
    if (filter !== 'all') results = results.filter((r) => String(r.category_id) === filter);
    const q = search.value.trim();
    if (q) {
      const w = q.toLowerCase();
      results = results.filter((r) => (r.name || '').toLowerCase().includes(w) || (r.description || '').toLowerCase().includes(w));
    }
    summary.textContent = (q || filter !== 'all') ? `找到 ${results.length} 个资源` : `共 ${results.length} 个资源`;
    empty.hidden = results.length > 0;
    list.innerHTML = results.map((r) => {
      const extIcon = fileIcon(r.file_type);
      const sizeStr = r.size ? formatBytes(r.size) : '—';
      const catStr = r.category_name ? `<span class="article-cat">${escapeHtml(r.category_name)}</span>` : '';
      const downloadLabel = r.source === 'r2' ? '下载' : '访问';
      return `<a class="resource-card" href="${escapeHtml(r.url)}" target="_blank" rel="noopener" data-id="${r.id}">
        <div class="resource-cover">
          <span class="resource-icon">${extIcon}</span>
          <small>${escapeHtml((r.file_type || 'EXT').toUpperCase().split('/').pop())}</small>
        </div>
        <div class="resource-body">
          <h3>${escapeHtml(r.name)}</h3>
          <p>${escapeHtml(r.description || '无描述')}</p>
          <div class="article-meta"><time>${formatDate(r.time)}</time>${catStr}<span>${sizeStr}</span><span class="resource-downloads">${r.downloads || 0} 次</span></div>
        </div>
        <div class="resource-go">${downloadLabel} →</div>
      </a>`;
    }).join('') || '<p class="form-message" style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:32px 0;">暂无符合条件的资源。</p>';
  };

  // 分类筛选条
  fetch(`${api}/categories?type=resource`).then((r) => r.json()).then((data) => {
    const cats = data.categories || [];
    filters.innerHTML = '<button class="active" data-filter="all">全部</button>' + cats.map((c) => `<button data-filter="${c.id}">${escapeHtml(c.name)}</button>`).join('');
  }).catch(() => {});

  const load = () => {
    list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    fetch(`${api}/resources`).then((r) => r.json()).then((data) => {
      allResources = data.resources || [];
      render();
    }).catch(() => { list.innerHTML = '<p class="form-message" style="grid-column:1/-1">资源暂时无法加载。</p>'; });
  };
  load();

  search.addEventListener('input', debounce(render));
  $('#clearResourceSearch')?.addEventListener('click', () => { search.value = ''; render(); search.focus(); });
  filters.addEventListener('click', (event) => {
    const btn = event.target.closest('button'); if (!btn) return;
    filter = btn.dataset.filter;
    filters.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });
}

// 归档页：双 Tab 切换 + 分别渲染归档文章(archived=1)和归档资源(archived=1)
function initArchive() {
  const postSection = $('#section-posts'); if (!postSection) return;
  const tabs = { posts: $('#tab-posts'), resources: $('#tab-resources') };
  const sections = { posts: postSection, resources: $('#section-resources') };
  function switchTab(key) {
    Object.entries(tabs).forEach(([k, el]) => {
      const active = k === key;
      el?.classList.toggle('active', active);
      el?.setAttribute('aria-selected', String(active));
    });
    Object.entries(sections).forEach(([k, el]) => { if (el) el.hidden = k !== key; });
  }
  tabs.posts?.addEventListener('click', () => switchTab('posts'));
  tabs.resources?.addEventListener('click', () => switchTab('resources'));

  const coverClasses = ['cover-a', 'cover-b', 'cover-c', 'cover-d'];

  // ========== 归档文章 ==========
  const pList = $('#archivePostList'), pSearch = $('#archivePostSearch'), pSummary = $('#archivePostSummary'), pEmpty = $('#archivePostEmpty'), pFilters = $('#archivePostFilters');
  let pAll = [], pFilter = 'all';
  const renderPosts = () => {
    let r = pAll;
    if (pFilter !== 'all') r = r.filter((p) => String(p.category_id) === pFilter);
    const q = pSearch.value.trim();
    if (q) {
      const w = q.toLowerCase();
      r = r.filter((p) => (p.title || '').toLowerCase().includes(w) || (p.excerpt || '').toLowerCase().includes(w));
    }
    pSummary.textContent = (q || pFilter !== 'all') ? `找到 ${r.length} 篇归档文章` : `共 ${r.length} 篇归档文章`;
    pEmpty.hidden = r.length > 0;
    pList.innerHTML = r.map((p, i) => {
      const cover = coverClasses[i % coverClasses.length];
      const tagArr = p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      const tagHtml = tagArr.length ? `<div class="tag-row">${tagArr.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : '';
      const coverLabel = (tagArr[0] || p.title || 'ARCHIVE').toUpperCase().slice(0, 8);
      return `<a class="article-card archived" href="article.html?slug=${encodeURIComponent(p.slug)}">
        <div class="cover ${cover}"><small>${String(p.id).padStart(2, '0')}</small><span>${escapeHtml(coverLabel)}</span></div>
        <div class="card-content">
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.excerpt || '')}</p>
          ${tagHtml}
          <div class="article-meta"><time>${formatDate(p.time)}</time>${p.category_name ? `<span class="article-cat">${escapeHtml(p.category_name)}</span>` : ''}<span>${p.views || 0} 阅读</span><span class="article-archived">已归档</span></div>
        </div>
      </a>`;
    }).join('') || '<p class="form-message" style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:24px 0;">暂无归档文章。</p>';
  };
  fetch(`${api}/categories?type=post`).then((r) => r.json()).then((d) => {
    const cats = d.categories || [];
    pFilters.innerHTML = '<button class="active" data-filter="all">全部</button>' + cats.map((c) => `<button data-filter="${c.id}">${escapeHtml(c.name)}</button>`).join('');
  }).catch(() => {});
  pList.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  fetch(`${api}/posts?archived=1&status=all`).then((r) => r.json()).then((d) => { pAll = d.posts || []; const c = document.getElementById('tabCountPosts'); if (c) c.textContent = pAll.length; renderPosts(); }).catch(() => { pList.innerHTML = '<p class="form-message">归档文章暂时无法加载。</p>'; });
  pSearch.addEventListener('input', debounce(renderPosts));
  $('#clearArchivePostSearch')?.addEventListener('click', () => { pSearch.value = ''; renderPosts(); pSearch.focus(); });
  pFilters.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; pFilter = b.dataset.filter; pFilters.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); renderPosts(); });

  // ========== 归档资源 ==========
  const rList = $('#archiveResList'), rSearch = $('#archiveResSearch'), rSummary = $('#archiveResSummary'), rEmpty = $('#archiveResEmpty'), rFilters = $('#archiveResFilters');
  let rAll = [], rFilter = 'all';
  const renderRes = () => {
    let r = rAll;
    if (rFilter !== 'all') r = r.filter((x) => String(x.category_id) === rFilter);
    const q = rSearch.value.trim();
    if (q) {
      const w = q.toLowerCase();
      r = r.filter((x) => (x.name || '').toLowerCase().includes(w) || (x.description || '').toLowerCase().includes(w));
    }
    rSummary.textContent = (q || rFilter !== 'all') ? `找到 ${r.length} 个归档资源` : `共 ${r.length} 个归档资源`;
    rEmpty.hidden = r.length > 0;
    rList.innerHTML = r.map((x) => {
      const extIcon = fileIcon(x.file_type);
      const sizeStr = x.size ? formatBytes(x.size) : '—';
      const catStr = x.category_name ? `<span class="article-cat">${escapeHtml(x.category_name)}</span>` : '';
      const downloadLabel = x.source === 'r2' ? '下载' : '访问';
      return `<a class="resource-card archived" href="${escapeHtml(x.url)}" target="_blank" rel="noopener" data-id="${x.id}">
        <div class="resource-cover">
          <span class="resource-icon">${extIcon}</span>
          <small>${escapeHtml((x.file_type || 'EXT').toUpperCase().split('/').pop())}</small>
        </div>
        <div class="resource-body">
          <h3>${escapeHtml(x.name)}</h3>
          <p>${escapeHtml(x.description || '无描述')}</p>
          <div class="article-meta"><time>${formatDate(x.time)}</time>${catStr}<span>${sizeStr}</span><span class="resource-downloads">${x.downloads || 0} 次</span><span class="article-archived">已归档</span></div>
        </div>
        <div class="resource-go">${downloadLabel} →</div>
      </a>`;
    }).join('') || '<p class="form-message" style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:24px 0;">暂无归档资源。</p>';
  };
  fetch(`${api}/categories?type=resource`).then((r) => r.json()).then((d) => {
    const cats = d.categories || [];
    rFilters.innerHTML = '<button class="active" data-filter="all">全部</button>' + cats.map((c) => `<button data-filter="${c.id}">${escapeHtml(c.name)}</button>`).join('');
  }).catch(() => {});
  fetch(`${api}/resources?archived=1`).then((r) => r.json()).then((d) => { rAll = d.resources || []; const c = document.getElementById('tabCountResources'); if (c) c.textContent = rAll.length; renderRes(); }).catch(() => { rList.innerHTML = '<p class="form-message" style="grid-column:1/-1">归档资源暂时无法加载。</p>'; });
  rSearch.addEventListener('input', debounce(renderRes));
  $('#clearArchiveResSearch')?.addEventListener('click', () => { rSearch.value = ''; renderRes(); rSearch.focus(); });
  rFilters.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; rFilter = b.dataset.filter; rFilters.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); renderRes(); });
}

initProjects(); loadCount(); initCountRealtime(); loadGuestbook(); initFriends(); initBook(); initArticles(); loadArticleDetail(); initResources(); initArchive();

// 联系方式卡片：可跳转的链接正常打开，无法链接的（微信/QQ）点击复制账号
$('#contactGrid')?.addEventListener('click', (event) => {
  const card = event.target.closest('.contact-card');
  if (!card) return;
  const value = card.dataset.copy;
  if (!value) return;
  // 链接型卡片（a 标签）走默认跳转，仅补充复制；按钮型卡片阻止默认并复制
  const isLink = card.tagName === 'A' && card.getAttribute('href');
  if (!isLink) event.preventDefault();
  const fallback = () => { const t = document.createElement('textarea'); t.value = value; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch {} t.remove(); };
  if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(value).catch(fallback); } else { fallback(); }
  card.classList.add('copied');
  setTimeout(() => card.classList.remove('copied'), 1200);
  toast(`已复制：${value}`);
});

// 首页长页叙事动效：只在首页启用，避免影响其他页面性能。
if (document.body.dataset.page === 'home') {
  const progress = $('#scrollProgress');
  const updateProgress = () => {
    const height = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = `${height > 0 ? (window.scrollY / height) * 100 : 0}%`;
  };
  updateProgress(); window.addEventListener('scroll', updateProgress, { passive: true });

  const typeTarget = $('#typingLine');
  const states = ["'shipping'", "'exploring'", "'refining'", "'online'"];
  let stateIndex = 0, charIndex = 0, erasing = false;
  function typeState() {
    if (!typeTarget) return;
    const value = states[stateIndex];
    typeTarget.textContent = value.slice(0, charIndex);
    if (!erasing && charIndex < value.length) { charIndex += 1; setTimeout(typeState, 95); return; }
    if (!erasing) { erasing = true; setTimeout(typeState, 1400); return; }
    if (charIndex > 0) { charIndex -= 1; setTimeout(typeState, 48); return; }
    erasing = false; stateIndex = (stateIndex + 1) % states.length; setTimeout(typeState, 260);
  }
  typeState();

  const clock = $('#workbenchClock');
  const refreshClock = () => { if (clock) clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false }); };
  refreshClock(); setInterval(refreshClock, 1000);

  // 胶片播放机已替换为科幻地球自转模型，无需 JS 生成

  const grid = $('#contributionGrid');
  if (grid) {
    let total = 0;
    for (let day = 0; day < 156; day += 1) { const level = (day * 11 + Math.floor(day / 6) * 7) % 13; const activity = level > 8 ? 4 : level > 6 ? 3 : level > 3 ? 2 : level > 1 ? 1 : 0; const cell = document.createElement('i'); cell.dataset.level = activity; cell.title = `${activity * 2 + (day % 3)} 次活动`; grid.append(cell); total += activity * 2 + (day % 3); }
    $('#contributionCount').textContent = `${total} contributions`;
  }

  // 想法卡片：循环切换颜色主题，并接入免费文案 API（Hitokoto 一言）刷新内容
  const ideaFallback = ['先理解，再构建。', '细节决定体验温度。', '可访问性也是美感。', '让复杂变得自然。', '少即是多，但不止于少。', '好奇心是最好的引擎。', '在约束中找到自由。', '把每次提交当作对话。'];
  let ideaThemeIndex = 0;
  const ideaFront = document.querySelector('.idea-front');
  const ideaText = $('#ideaText');
  const ideaTag = $('#ideaTag');
  $('#shuffleIdeas')?.addEventListener('click', async () => {
    const stack = document.querySelector('.idea-stack');
    stack?.classList.toggle('shuffled');
    ideaThemeIndex = (ideaThemeIndex + 1) % 6;
    if (ideaFront) ideaFront.dataset.theme = String(ideaThemeIndex);
    if (ideaTag) ideaTag.textContent = `NOTE_${String(ideaThemeIndex + 1).padStart(2, '0')}`;
    if (ideaText) {
      ideaText.style.opacity = '0';
      let sentence = ideaFallback[ideaThemeIndex % ideaFallback.length];
      try {
        const res = await fetch('https://v1.hitokoto.cn/?encode=json&c=i&c=k&c=d&c=e&max_length=24');
        const data = await res.json();
        if (data && data.hitokoto) sentence = data.hitokoto;
      } catch { /* 离线或被拦截时使用本地文案兜底 */ }
      ideaText.textContent = sentence;
      setTimeout(() => { ideaText.style.opacity = '1'; }, 220);
    }
    toast('换一张卡片，继续想。');
  });
  const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('in-view'); }), { threshold: .14 });
  document.querySelectorAll('.home-reveal').forEach((element) => revealObserver.observe(element));
}
