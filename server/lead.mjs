// Приём заявок и заказов gaz-mag.ru – маленький сервис без зависимостей (Node 22), живёт на VPS Beget (РФ).
// POST /api/lead {form, fields{...}} → проверка → копия в /data/leads.jsonl → сообщение в Telegram.
// Копия пишется всегда, даже если Telegram недоступен: заявка не теряется.
// Окружение: TG_TOKEN (бот), TG_CHAT (кому слать, через запятую), PORT (8090), ORIGIN (https://gaz-mag.ru).
import { createServer } from 'node:http';
import { appendFile, mkdir } from 'node:fs/promises';

const PORT = Number(process.env.PORT || 8090);
const DATA = process.env.DATA_DIR || '/data';
const TG_TOKEN = process.env.TG_TOKEN || '';
const TG_CHATS = (process.env.TG_CHAT || '').split(',').map((s) => s.trim()).filter(Boolean);
const ORIGINS = (process.env.ORIGIN || 'https://gaz-mag.ru').split(',').map((s) => s.trim());

const MAX_BODY = 16 * 1024;
const MAX_FIELD = 2000;
// Не больше 5 заявок с одного адреса за 10 минут – от ботов и случайных повторов.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const hits = new Map();

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
  if (req.url === '/api/health') return send(res, 200, { ok: true, telegram: Boolean(TG_TOKEN && TG_CHATS.length) });
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

  const lead = { at: new Date().toISOString(), form: clean(body.form || 'Заявка с сайта').slice(0, 200), fields, consent: true, ip };
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
