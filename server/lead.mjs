// Приём заявок и заказов gaz-mag.ru – маленький сервис без зависимостей (Node 22), живёт на VPS Beget (РФ).
// POST /api/lead {form, consent, fields{...}, items[]} → проверка → копия в /data/leads.jsonl → сообщение в Telegram.
// Копия пишется всегда, даже если Telegram недоступен: заявка не теряется.
// Кабинет (вкладка «Заявки»): GET /api/leads и PATCH /api/leads/<номер> {stage} – только с логином и паролем кабинета
// (Basic, тот же вход, что у замка админки – правило стандарта 17.10.2026). Этапы и их история – /data/stages.json.
// Окружение: TG_TOKEN, TG_CHAT (через запятую), ADMIN_LOGIN, ADMIN_PASS, PORT (8090), ORIGIN (https://gaz-mag.ru).
import { createServer } from 'node:http';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';

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
    const to = (await redirects())[key];
    if (to) { res.writeHead(301, { Location: to, 'Cache-Control': 'public, max-age=86400' }); return res.end(); }
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(await page404());
  }
  if (req.url === '/api/health') return send(res, 200, { ok: true, telegram: Boolean(TG_TOKEN && TG_CHATS.length), admin: Boolean(ADMIN) });

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
