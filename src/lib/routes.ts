// Адреса сайта (ЧПУ) – одно место для страниц, меню, карты сайта, админки и редиректов.
// Владелец 18.10.2026: «нормальные ЧПУ с правильной иерархией и названием товара, без цифр и tproduct – мы не в Тильде».
// Прежние адреса (Тильда и копия до 18.10) отдают 301 на новые – LEGACY ниже + legacy[] у товаров (dist/redirects.json).

export const R = {
  home: '/',
  catalog: '/katalog',
  services: '/uslugi',
  montag: '/uslugi/podklyuchenie-gaza-i-montazh-otopleniya',
  install: '/uslugi/ustanovka-gazovogo-kotla',
  hubert: '/kotly-hubert',
  promos: '/akcii',
  hubertDy: '/akcii/kotel-hubert-s-montazhom',
  about: '/o-kompanii',
  requisites: '/rekvizity',
  policy: '/politika-konfidencialnosti',
  agreement: '/soglasie-na-obrabotku-dannyh',
  cookie: '/politika-cookie',
  oferta: '/oferta',
  thanks: '/spasibo',
  sitemap: '/karta-sayta',
  souz: '/souz',
} as const;

/** Разделы каталога: ключ (как в данных и в Тильде) → адрес раздела. */
export const CATALOG_URL = {
  catalog_boilers: 'gazovye-kotly',
  catalog_gaz_waterheaters: 'gazovye-kolonki',
  catalog_el_waterheaters: 'elektricheskie-vodonagrevateli',
  catalog_indirect_boilers: 'boylery-kosvennogo-nagreva',
  catalog_other: 'tovary-dlya-otopleniya',
  gas: 'datchiki-i-schetchiki-gaza',
} as const;
export type CatalogKey = keyof typeof CATALOG_URL;

export const catalogPath = (key: string) => `${R.catalog}/${CATALOG_URL[key as CatalogKey] ?? key}`;
export const productPath = (catalog: string, slug: string) => `${catalogPath(catalog)}/${slug}`;
/** Ключ раздела по адресу страницы: /katalog/gazovye-kotly/… → catalog_boilers (для категории заявки). */
export function catalogKeyOf(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'katalog' || !parts[1]) return parts[0] || '';
  return Object.keys(CATALOG_URL).find((k) => CATALOG_URL[k as CatalogKey] === parts[1]) ?? parts[1];
}

/** Прежние адреса страниц → новые (301). Адреса товаров – в products.json (legacy[]). */
export const LEGACY: Record<string, string> = {
  '/catalogcentr': R.catalog,
  ...Object.fromEntries(Object.entries(CATALOG_URL).map(([k]) => [`/${k}`, catalogPath(k)])),
  '/montag': R.montag,
  '/ustanovka-kotla': R.install,
  '/hubert': R.hubert,
  '/hubert-dy': R.hubertDy,
  '/about': R.about,
  '/rekvezit': R.requisites,
  '/policy': R.policy,
  '/agreement': R.agreement,
  '/cookie': R.cookie,
  '/thanks': R.thanks,
  '/fail': R.home,
};

const TR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
/** Адрес из названия: транслит как у Яндекса, до 90 знаков по целому слову. «Котёл HUBERT 10-24DY» → kotel-hubert-10-24dy. */
export function slugify(title: string, max = 90): string {
  let s = title.toLowerCase().split('').map((c) => TR[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > max) s = s.slice(0, max).replace(/-[^-]*$/, '');
  return s || 'tovar';
}
/** Уникальный адрес товара среди занятых: при совпадении – -2, -3… */
export function uniqueSlug(title: string, taken: Set<string>): string {
  const base = slugify(title);
  let s = base;
  for (let n = 2; taken.has(s); n++) s = `${base}-${n}`;
  return s;
}
