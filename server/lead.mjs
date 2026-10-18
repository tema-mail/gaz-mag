// Приём заявок и заказов gaz-mag.ru – маленький сервис без зависимостей (Node 22), живёт на VPS Beget (РФ).
// POST /api/lead {form, consent, fields{...}, items[]} → проверка → копия в /data/leads.jsonl → сообщение в Telegram.
// Копия пишется всегда, даже если Telegram недоступен: заявка не теряется.
// Кабинет (вкладка «Заявки»): GET /api/leads и PATCH /api/leads/<номер> {stage} – только с логином и паролем кабинета
// (Basic, тот же вход, что у замка админки – правило стандарта 17.10.2026). Этапы и их история – /data/stages.json.
// Окружение: TG_TOKEN, TG_CHAT (через запятую), ADMIN_LOGIN, ADMIN_PASS, PORT (8090), ORIGIN (https://gaz-mag.ru).
import { createServer } from 'node:http';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 8090);
const DATA = process.env.DATA_DIR || '/data';
const TG_TOKEN = process.env.TG_TOKEN || '';
const TG_CHATS = (process.env.TG_CHAT || '').split(',').map((s) => s.trim()).filter(Boolean);
const ORIGINS = (process.env.ORIGIN || 'https://gaz-mag.ru').split(',').map((s) => s.trim());
const ADMIN = process.env.ADMIN_LOGIN && process.env.ADMIN_PASS ? `${process.env.ADMIN_LOGIN}:${process.env.ADMIN_PASS}` : '';
const STAGES = ['новая', 'в работе', 'выполнена', 'отказ'];

const MAX_BODY = 16 * 1024;
const MAX_FIELD = 2000;
// Не больше 5 заявок с одного адреса за 10 минут – от ботов и случайных повторов.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const hits = new Map();

/** Basic-авторизация кабинета; сравнение за постоянное время. */
function authed(req) {
  const h = String(req.headers.authorization || '');
  if (!ADMIN || !h.startsWith('Basic ')) return false;
  const got = Buffer.from(Buffer.from(h.slice(6), 'base64').toString('utf8'));
  const want = Buffer.from(ADMIN);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Товары заявки: [{uid, title, variant, category, qty, price}] – из корзины или «заказа в один клик». */
function cleanItems(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 40).map((i) => ({
    uid: clean(i?.uid).slice(0, 40), title: clean(i?.title).slice(0, 300), variant: clean(i?.variant).slice(0, 200),
    category: clean(i?.category).slice(0, 80), qty: Math.max(1, Math.min(999, Number(i?.qty) || 1)), price: Math.max(0, Math.round(Number(i?.price) || 0)),
  })).filter((i) => i.title);
}
const pad = (n) => String(n).padStart(2, '0');
function leadId(d) {
  const n = new Date(d.getTime() + 7 * 3600e3); // время Новосибирска в номере
  return `GM-${String(n.getUTCFullYear()).slice(2)}${pad(n.getUTCMonth() + 1)}${pad(n.getUTCDate())}-${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${Math.random().toString(36).slice(2, 4)}`;
}
async function readStages() {
  try { return JSON.parse(await readFile(`${DATA}/stages.json`, 'utf8')); } catch { return {}; }
}
async function readLeads() {
  let text = '';
  try { text = await readFile(`${DATA}/leads.jsonl`, 'utf8'); } catch { return []; }
  const stages = await readStages();
  return text.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
    .map((l) => ({ ...l, stage: stages[l.id]?.stage || 'новая', history: stages[l.id]?.history || [] }))
    .reverse();
}

const RELEASE = process.env.RELEASE_DIR || '/releases/current';
let redirCache = { at: 0, map: {} };
async function redirects() {
  if (Date.now() - redirCache.at < 60_000) return redirCache.map;
  try { redirCache = { at: Date.now(), map: JSON.parse(await readFile(`${RELEASE}/redirects.json`, 'utf8')) }; } catch { redirCache.at = Date.now(); }
  return redirCache.map;
}
async function page404() {
  try { return await readFile(`${RELEASE}/404.html`, 'utf8'); } catch { return '<h1>404 – страница не найдена</h1>'; }
}

// ── Боевой режим: данные сайта правит админка на сервере (владелец 18.10.2026 «убирай цепочку GitHub»). ──
// /content/products.json – источник правды в бою; запись – с проверкой версии (кто-то сохранил раньше → 409);
// после записи – задание сборщику в /queue (gaz-mag-builder соберёт и выложит сайт, история – git в /content).
const CONTENT = process.env.CONTENT_DIR || '/content';
const QUEUE = process.env.QUEUE_DIR || '/queue';
const STATE_DIR = process.env.STATE_DIR || '/state';
const sha = (t) => createHash('sha1').update(t).digest('hex').slice(0, 16);
async function readBody(req, limit) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error('too big'), { code: 413 }); chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}
async function queueBuild(message) {
  await writeFile(`${QUEUE}/${Date.now()}${String(Math.random()).slice(2, 6)}-build`, message.slice(0, 300) + '\n');
}
async function adminApi(req, res) {
  const url = req.url.split('?')[0];
  if (url === '/api/admin/products' && req.method === 'GET') {
    const text = await readFile(`${CONTENT}/products.json`, 'utf8');
    return send(res, 200, { ok: true, version: sha(text), products: JSON.parse(text) });
  }
  if (url === '/api/admin/products' && req.method === 'PUT') {
    const body = JSON.parse(await readBody(req, 4 * 1024 * 1024));
    if (!Array.isArray(body.products) || !body.products.every((p) => p && p.id && p.title && p.path)) return send(res, 422, { ok: false, error: 'products' });
    const cur = await readFile(`${CONTENT}/products.json`, 'utf8');
    if (body.base !== sha(cur)) return send(res, 409, { ok: false, error: 'conflict' });
    const next = JSON.stringify(body.products, null, 1).replace(/\u2014/g, '\u2013') + '\n';
    await writeFile(`${CONTENT}/products.json.tmp`, next);
    await rename(`${CONTENT}/products.json.tmp`, `${CONTENT}/products.json`);
    await queueBuild(String(body.message || 'Админка: правка товаров'));
    return send(res, 200, { ok: true, version: sha(next) });
  }
  if (url === '/api/admin/upload' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req, 14 * 1024 * 1024));
    const name = String(body.name || '');
    if (!/^[\w-]{1,80}\.(jpe?g|png|webp)$/i.test(name)) return send(res, 422, { ok: false, error: 'name' });
    await mkdir(`${CONTENT}/uploads`, { recursive: true });
    await writeFile(`${CONTENT}/uploads/${name}`, Buffer.from(String(body.data || ''), 'base64'));
    return send(res, 200, { ok: true });
  }
  if (url === '/api/admin/build' && req.method === 'GET') {
    let st = {};
    try { st = JSON.parse(await readFile(`${STATE_DIR}/status.json`, 'utf8')); } catch {}
    return send(res, 200, { ok: true, ...st });
  }
  return send(res, 404, { ok: false });
}

const phoneOk = (v) => String(v || '').replace(/\D/g, '').length >= 10;
const clean = (v) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, MAX_FIELD);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
  return list.length > LIMIT;
}

async function telegram(text) {
  if (!TG_TOKEN || !TG_CHATS.length) return 'не настроен';
  const res = await Promise.all(TG_CHATS.map((chat) => fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10000),
  }).then((r) => r.ok).catch(() => false)));
  return res.every(Boolean) ? 'отправлено' : 'ошибка';
}

// Порядок полей в сообщении: сначала контакты, потом заказ, потом остальное (ответы квиза и т.п.).
const LABELS = { Name: 'Имя', Phone: 'Телефон', Email: 'E-mail', Order: 'Заказ', Total: 'Итого', Comment: 'Комментарий', Page: 'Страница' };

function message(lead) {
  const f = lead.fields;
  const lines = [`<b>${esc(lead.form)}</b>`];
  lines[0] += ` · № ${lead.id}`;
  for (const k of Object.keys(LABELS)) if (f[k]) lines.push(`<b>${LABELS[k]}:</b> ${k === 'Order' ? '\n' : ''}${esc(f[k])}`);
  for (const [k, v] of Object.entries(f)) if (!LABELS[k] && v) lines.push(`<b>${esc(k)}:</b> ${esc(v)}`);
  lines.push(`<i>${new Date(lead.at).toLocaleString('ru-RU', { timeZone: 'Asia/Novosibirsk' })} НСК</i>`);
  return lines.join('\n');
}

function send(res, code, body, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin && ORIGINS.includes(origin)) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' });
  res.writeHead(code, headers);
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const origin = req.headers.origin;
  const ip0 = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  // 301 с прежних адресов: карта – redirects.json текущей выкладки (монтируется /releases только на чтение)
  if (req.url.startsWith('/api/go')) {
    let u = '';
    // исходный адрес – из заголовка nginx (X-Original-URI) или ?u= для ручной проверки
    const raw = String(req.headers['x-original-uri'] || new URL(req.url, 'http://x').searchParams.get('u') || '');
    try { u = decodeURIComponent(raw.split('?')[0]); } catch { u = raw.split('?')[0]; }
    const key = u.replace(/\/+$/, '') || '/';
    const map = await redirects();
    // точный прежний адрес; иначе тильдовский товар по номеру (окончание адреса у Тильды любое)
    const tid = key.match(/tproduct\/\d+-(\d+)/)?.[1] || key.match(/tproduct\/(\d+)$/)?.[1];
    const to = map[key] || map[`tilda:${tid}`];
    const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''; // utm и прочие метки – сохраняем
    if (to) { res.writeHead(301, { Location: to + query, 'Cache-Control': 'public, max-age=86400' }); return res.end(); }
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(await page404());
  }
  if (req.url === '/api/health') return send(res, 200, { ok: true, telegram: Boolean(TG_TOKEN && TG_CHATS.length), admin: Boolean(ADMIN) });

  // Кабинет, боевой режим: товары, фото, статус сборки – только с паролем кабинета.
  if (req.url.startsWith('/api/admin/')) {
    if (!authed(req)) { if (limited('auth:' + ip0)) return send(res, 429, { ok: false, error: 'rate' }); return send(res, 401, { ok: false }); }
    try { return await adminApi(req, res); } catch (e) { return send(res, e.code === 413 ? 413 : 500, { ok: false, error: e.code === 413 ? 'too big' : 'server' }); }
  }

  // Кабинет: список заявок и смена этапа – только с паролем; неверный пароль считается в лимит попыток.
  if (req.url === '/api/leads' || req.url.startsWith('/api/leads/')) {
    if (!authed(req)) { if (limited('auth:' + ip0)) return send(res, 429, { ok: false, error: 'rate' }); return send(res, 401, { ok: false }); }
    if (req.method === 'GET' && req.url === '/api/leads') return send(res, 200, { ok: true, leads: await readLeads() });
    if (req.method === 'PATCH') {
      const id = decodeURIComponent(req.url.slice('/api/leads/'.length));
      let body = '';
      for await (const c of req) { body += c; if (body.length > 2000) return send(res, 413, { ok: false }); }
      let stage;
      try { stage = JSON.parse(body).stage; } catch { return send(res, 400, { ok: false }); }
      if (!STAGES.includes(stage) || !/^GM-[\w-]{6,30}$/.test(id)) return send(res, 422, { ok: false });
      const all = await readStages();
      const cur = all[id] || { stage: 'новая', history: [] };
      if (cur.stage !== stage) { cur.history = [...cur.history, { at: new Date().toISOString(), from: cur.stage, to: stage }].slice(-50); cur.stage = stage; }
      all[id] = cur;
      await writeFile(`${DATA}/stages.json.tmp`, JSON.stringify(all));
      await rename(`${DATA}/stages.json.tmp`, `${DATA}/stages.json`);
      return send(res, 200, { ok: true, stage: cur.stage, history: cur.history });
    }
    return send(res, 405, { ok: false });
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
    return res.end();
  }
  if (req.url !== '/api/lead' || req.method !== 'POST') return send(res, 404, { ok: false });
  if (origin && !ORIGINS.includes(origin)) return send(res, 403, { ok: false, error: 'origin' });

  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) return send(res, 413, { ok: false }, origin);
    chunks.push(c);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(res, 400, { ok: false }, origin); }

  const fields = {};
  for (const [k, v] of Object.entries(body?.fields || {}).slice(0, 40)) fields[clean(k).slice(0, 120)] = clean(v);
  // Ловушка для ботов: скрытое поле website люди не заполняют – отвечаем «ок», но не сохраняем.
  if (fields.website) return send(res, 200, { ok: true }, origin);
  delete fields.website;
  if (!phoneOk(fields.Phone)) return send(res, 422, { ok: false, error: 'phone' }, origin);
  // Согласие на обработку ПДн проверяет и сервер (152-ФЗ, ст. 9): без него заявку не принимаем.
  if (body?.consent !== true) return send(res, 422, { ok: false, error: 'consent' }, origin);

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (limited(ip)) return send(res, 429, { ok: false, error: 'rate' }, origin);

  const now = new Date();
  const items = cleanItems(body.items);
  const page = fields.Page || '';
  const category = items[0]?.category || (page.split('/')[1] || '');
  const lead = { id: leadId(now), at: now.toISOString(), form: clean(body.form || 'Заявка с сайта').slice(0, 200), fields, items, category, source: clean(body.source).slice(0, 120), consent: true, ip };
  try {
    await mkdir(DATA, { recursive: true });
    await appendFile(`${DATA}/leads.jsonl`, JSON.stringify(lead) + '\n');
  } catch (e) {
    console.error('не записалось', e);
    return send(res, 500, { ok: false }, origin);
  }
  const tg = await telegram(message(lead));
  console.log(lead.at, lead.form, 'telegram:', tg);
  send(res, 200, { ok: true }, origin);
}).listen(PORT, () => console.log('gaz-mag lead: порт', PORT, '| telegram:', TG_TOKEN && TG_CHATS.length ? 'да' : 'нет'));
