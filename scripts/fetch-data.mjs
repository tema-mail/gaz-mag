// Снимает магазин с живого gaz-mag.ru (Тильда) и складывает в src/data:
// товары с вариантами и характеристиками, фильтры каталогов, юридические тексты.
// Картинки качает в public/img и жмёт в webp.
// Запуск: npm run data           – товары, фильтры, картинки товаров
//         npm run data -- --img  – картинки страниц (ссылки tildacdn в src/)
//         npm run data -- --legal – политика, оферта, соглашение из попапов главной
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(ROOT, 'src/data');
const IMG = path.join(ROOT, 'public/img');
const REF = { Referer: 'https://gaz-mag.ru/', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36' };

// Части магазина Тильды: страница каталога → storepart. Снято со страниц 14.10.2026.
export const STOREPARTS = {
  catalog_boilers: '135064394541',
  catalog_gaz_waterheaters: '112764792661',
  catalog_el_waterheaters: '942589913541',
  catalog_indirect_boilers: '691454150271',
  catalog_other: '371936167301',
  gas: '254334147021',
  specials: '120758867861', // «Специальные предложения» на главной
  hubert: '694050073893', // каталог на странице /hubert
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(url, { headers: REF, signal: AbortSignal.timeout(25000) });
      const txt = await res.text();
      if (txt.trim().startsWith('{')) return JSON.parse(txt);
    } catch {}
    await sleep(3000);
  }
  throw new Error('Пустой ответ: ' + url);
}

/** Имя локального файла по адресу tildacdn: tild3335-…/Mask_group.png → tild3335-…_Mask_group */
export function localName(url) {
  const u = new URL(url);
  const parts = u.pathname.split('/').filter(Boolean);
  const dir = parts[parts.length - 2] || 'x';
  const file = parts[parts.length - 1].replace(/\.[a-z0-9]+$/i, '');
  return `${dir.slice(0, 13)}_${file}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function download(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: REF, signal: AbortSignal.timeout(30000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {}
    await sleep(1500);
  }
  throw new Error('Не скачалось: ' + url);
}

/** Картинка → webp нужных ширин. svg и gif – как есть. Возвращает базовое имя. */
async function saveImage(url, dir, widths) {
  const name = localName(url);
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  await mkdir(path.join(IMG, dir), { recursive: true });
  if (ext === '.svg' || ext === '.gif') {
    const f = path.join(IMG, dir, name + ext);
    if (!existsSync(f)) await writeFile(f, await download(url));
    return `/img/${dir}/${name}${ext}`;
  }
  const need = widths.filter((w) => !existsSync(path.join(IMG, dir, `${name}-${w}.webp`)));
  if (need.length) {
    const buf = await download(url);
    for (const w of need) {
      await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 })
        .toFile(path.join(IMG, dir, `${name}-${w}.webp`));
    }
  }
  return `/img/${dir}/${name}`;
}

async function pool(items, n, fn) {
  let i = 0;
  const run = async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } };
  await Promise.all(Array.from({ length: n }, run));
}

// Длинное тире владелец запретил – в данных сразу короткое.
const dump = (v) => JSON.stringify(v, null, 1).replace(/—/g, '–');
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(/\s/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const clean = (s) => String(s ?? '').replace(/ /g, ' ').trim();

// Защита правок админки: если products.json последним менял коммит «Админка: …», генератор его не трогает
// (правило кабинета-стандарта 16.10.2026). Переснять насильно: npm run data -- --force.
import { execSync } from 'node:child_process';
function adminEdited() {
  try {
    const msg = execSync('git log -1 --format=%s -- src/data/products.json', { cwd: ROOT }).toString().trim();
    return msg.startsWith('Админка:') ? msg : '';
  } catch { return ''; }
}

async function store() {
  const edited = adminEdited();
  if (edited && !process.argv.includes('--force')) {
    console.error(`products.json правили в админке («${edited}») – не перезаписываю. Переснять с Тильды поверх правок: npm run data -- --force`);
    process.exit(1);
  }
  const all = new Map();
  const filters = {};
  for (const [page, sp] of Object.entries(STOREPARTS)) {
    const d = await getJson(`https://store.tildaapi.com/api/getproductslist/?storepartuid=${sp}&recid=0&c=${Date.now()}&getparts=true&getoptions=true&slice=1&size=500`);
    // Фильтры каталога в том виде, в каком их включил владелец в Тильде (без значений – значения считаем сами).
    filters[page] = (d.filters?.filters || []).map((f) => ({ label: f.label, control: f.control, name: f.name }));
    for (const p of d.products) {
      const id = String(p.uid);
      const prev = all.get(id);
      if (prev) { prev.lists.push(page); continue; }
      const options = JSON.parse(p.json_options || '[]').map((o) => ({ title: clean(o.title), values: o.values.map(clean) }));
      all.set(id, {
        id,
        path: decodeURI(new URL(p.url).pathname).replace(/\/$/, ''),
        title: clean(p.title),
        brand: clean(p.brand),
        descr: clean(p.descr),
        text: clean(p.text),
        price: num(p.price),
        priceOld: num(p.priceold),
        sort: Number(p.sort) || 0,
        lists: [page],
        chars: (p.characteristics || []).map((c) => ({ t: clean(c.title), v: clean(c.value) })),
        options,
        editions: options.length
          ? (p.editions || []).map((e) => ({
            id: String(e.uid), price: num(e.price), priceOld: num(e.priceold),
            opts: Object.fromEntries(options.map((o) => [o.title, clean(e[o.title])])),
          }))
          : [],
        src: JSON.parse(p.gallery || '[]').map((g) => g.img),
      });
    }
    await sleep(1500);
  }
  const products = [...all.values()];
  // ЧПУ (18.10.2026): адреса товаров уже перенесены на /katalog/<раздел>/<slug> – берём их из текущего products.json по id,
  // новые товары с Тильды получают адрес из названия (как scripts/migrate-urls.mjs), прежний адрес – в legacy[] для 301.
  const prev = new Map((existsSync(path.join(DATA, 'products.json')) ? JSON.parse(await readFile(path.join(DATA, 'products.json'), 'utf8')) : []).map((p) => [p.id, p]));
  for (const p of products) {
    const o = prev.get(p.id);
    if (o?.slug) { const tilda = p.path; Object.assign(p, { catalog: o.catalog, slug: o.slug, path: o.path, legacy: [...new Set([...(o.legacy || []), tilda])] }); }
  }
  console.log('товаров', products.length, 'с вариантами', products.filter((p) => p.editions.length).length);
  await pool(products, 6, async (p) => {
    p.images = [];
    for (const s of p.src) p.images.push(await saveImage(s, 'p', [480, 1000]));
    delete p.src;
  });
  await writeFile(path.join(DATA, 'products.json'), dump(products));
  await writeFile(path.join(DATA, 'filters.json'), dump(filters));
}

/** Попапы t390 главной: политика, оферта, согласие. Разметку чистим до p/br/b/a/ul/li. */
async function legal() {
  const res = await fetch('https://gaz-mag.ru/', { headers: REF });
  const html = await res.text();
  const out = {};
  const keys = { polit: 'policy', oferta: 'oferta', agreement: 'agreement' };
  for (const m of html.matchAll(/<div id="rec\d+"[^>]*data-record-type="390"[\s\S]*?(?=<div id="rec\d+"|<\/body>)/g)) {
    const blk = m[0];
    const hook = blk.match(/data-tooltip-hook="#popup:([a-z]+)"/)?.[1];
    if (!hook || !keys[hook]) continue;
    const title = clean(blk.match(/class="t390__title[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1].replace(/<[^>]+>/g, ' '));
    let body = blk.match(/class="t390__descr[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)?.[1] || '';
    body = body
      .replace(/<(?!\/?(br|b|strong|a|ul|ol|li|p)\b)[^>]+>/gi, '')
      .replace(/<(b|strong|ul|ol|li|p)\b[^>]*>/gi, '<$1>')
      .replace(/<a\b[^>]*href="([^"]*)"[^>]*>/gi, '<a href="$1">')
      .replace(/&nbsp;/g, ' ');
    out[keys[hook]] = { title, html: body.trim() };
  }
  console.log('юридических', Object.keys(out));
  await writeFile(path.join(DATA, 'legal.json'), dump(out));
}

/** Все ссылки static.tildacdn.com из src/ → public/img/t, карта в src/data/images.json */
async function pageImages() {
  const files = [];
  const scan = async (dir) => {
    for (const n of await readdir(dir)) {
      const f = path.join(dir, n);
      if ((await stat(f)).isDirectory()) await scan(f);
      else if (/\.(astro|ts|tsx|json)$/.test(n) && n !== 'images.json' && n !== 'products.json') files.push(f);
    }
  };
  await scan(path.join(ROOT, 'src'));
  const urls = new Set();
  for (const f of files) {
    const src = await readFile(f, 'utf8');
    for (const m of src.matchAll(/https:\/\/static\.tildacdn\.com\/[^\s"'`)]+/g)) urls.add(m[0]);
    // Ссылки, собранные как T + 'tild…/file.png'
    for (const m of src.matchAll(/['"`](tild[0-9a-f]{4}-[0-9a-f-]+\/[^'"`\s]+)['"`]/g)) urls.add('https://static.tildacdn.com/' + m[1]);
  }
  const mapFile = path.join(DATA, 'images.json');
  const map = existsSync(mapFile) ? JSON.parse(await readFile(mapFile, 'utf8')) : {};
  await pool([...urls].filter((u) => !map[u]), 6, async (u) => { map[u] = await saveImage(u, 't', [800, 1600]); });
  await writeFile(mapFile, JSON.stringify(map, null, 1));
  console.log('картинок страниц', Object.keys(map).length);
}

await mkdir(DATA, { recursive: true });
if (process.argv.includes('--img')) await pageImages();
else if (process.argv.includes('--legal')) await legal();
else await store();
