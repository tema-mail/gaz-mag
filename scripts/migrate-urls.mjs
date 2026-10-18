// Разовый перенос товаров на ЧПУ (18.10.2026): catalog (ключ раздела из прежнего адреса), slug из названия,
// legacy[] – прежний адрес Тильды, path – /katalog/<раздел>/<slug>. Повторный запуск ничего не меняет.
import { readFileSync, writeFileSync } from 'node:fs';
const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
const CAT = { catalog_boilers: 'gazovye-kotly', catalog_gaz_waterheaters: 'gazovye-kolonki', catalog_el_waterheaters: 'elektricheskie-vodonagrevateli', catalog_indirect_boilers: 'boylery-kosvennogo-nagreva', catalog_other: 'tovary-dlya-otopleniya', gas: 'datchiki-i-schetchiki-gaza' };
const slugify = (t, max = 90) => { let s = t.toLowerCase().split('').map((c) => TR[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); if (s.length > max) s = s.slice(0, max).replace(/-[^-]*$/, ''); return s || 'tovar'; };
const file = 'src/data/products.json';
const list = JSON.parse(readFileSync(file, 'utf8'));
const taken = new Set(list.filter((p) => p.slug).map((p) => p.slug));
let moved = 0;
for (const p of list) {
  if (p.slug && p.catalog) continue;
  const old = p.path;
  p.catalog = old.split('/')[1];
  if (!CAT[p.catalog]) throw new Error('нет раздела для ' + old);
  let s = slugify(p.title), base = s;
  for (let n = 2; taken.has(s); n++) s = `${base}-${n}`;
  taken.add(s);
  p.slug = s;
  p.legacy = [...new Set([...(p.legacy || []), old])];
  p.path = `/katalog/${CAT[p.catalog]}/${s}`;
  moved++;
}
writeFileSync(file, JSON.stringify(list, null, 1) + '\n');
console.log('перенесено на ЧПУ:', moved, '| всего:', list.length, '| уникальных адресов:', new Set(list.map((p) => p.path)).size);
