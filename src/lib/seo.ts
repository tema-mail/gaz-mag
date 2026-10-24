// SEO товара по умолчанию – одно место для страницы товара и редактора в админке.
// Владелец 18.10.2026: «товар создаю – карточка SEO сама заполняется: адрес, тайтл, дескриптор; в Болотном, а не в Новосибирске».
// Цену в текст не пишем: сохранённый в товар текст иначе устареет при смене цены.
// SEO 24.10.2026 (seo-lead → site-seo): title ≤60 знаков, description ≤160; складские хвосты из названия убираем,
// тип товара добавляем, если его нет в названии («ТЕПЛОКС ГПВ-10-Б» → «Газовая колонка ТЕПЛОКС ГПВ-10-Б»).

/** Тип товара раздела – для названий без типа. Ключ – раздел (catalogKeyOf из routes.ts). */
const TYPE: Record<string, [string, RegExp]> = {
  catalog_boilers: ['Газовый котёл', /котел|котёл/i],
  catalog_gaz_waterheaters: ['Газовая колонка', /колонк|водонагрев/i],
  catalog_el_waterheaters: ['Водонагреватель', /водонагрев|котел|котёл|бойлер/i],
  catalog_indirect_boilers: ['Бойлер косвенного нагрева', /бойлер/i],
};
// Слова, которые можно убрать из длинного title: тип и модель остаются, уточнения есть в description и на странице.
const SPARE = [/\s*\((?:новый|новая)[^)]*\)/gi, /\s+(?:\d-?х?-?\s*|двух\s*)конт\.?(?![а-яё])/gi, /\s+с\s+дисп\.?(?![а-яё])/gi,
  /^Бытовая\s+/i, /\s+автономного/gi, /\s+малогабаритный/gi, /\s+газовый/gi,
  /\s+(?:настенный|напольный)/gi, /\s+(?:двухконтурный|одноконтурный)/gi];
const MAX_T = 60, MAX_D = 160;

/** Название для поиска: без артикула склада в начале и с типом товара. */
export function seoName(title: string, catalog = ''): string {
  let t = title.trim().replace(/\s+/g, ' ').replace(/^\d{4,}\s+/, '');
  const type = TYPE[catalog];
  if (type && !type[1].test(t)) t = `${type[0]} ${t}`;
  return t;
}

export function productSeoTitle(title: string, catalog = ''): string {
  // сначала название с типом, потом – без добавленного типа (модель важнее приставки), потом короче хвост и обрезка
  const names = [...new Set([seoName(title, catalog), seoName(title)])].map((n) => {
    for (const rx of SPARE) {
      if (`${n} – купить в Болотном`.length <= MAX_T) break;
      n = n.replace(rx, '').replace(/\s+/g, ' ').trim();
    }
    return n.charAt(0).toUpperCase() + n.slice(1);
  });
  const cut = (n: string, max: number) => {
    let t = n.slice(0, max + 1).replace(/\s+\S*$/, '');
    while (/\s(?:с|со|без|для|и|на|в|по|[+\-–,(])$/i.test(t)) t = t.replace(/\s\S+$/, ''); // без висячих «с», «+», «без»
    return t.replace(/[,(]$/, '');
  };
  for (const tail of [' – купить в Болотном', ' – Болотное']) {
    const fit = names.find((n) => (n + tail).length <= MAX_T);
    if (fit) return fit + tail;
  }
  return `${cut(names[names.length - 1], MAX_T - ' – Болотное'.length)} – Болотное`;
}

export function productSeoDescr(title: string, brand = '', catalog = '', area = ''): string {
  const name = seoName(title, catalog);
  const b = brand.trim() && !name.toLowerCase().includes(brand.trim().toLowerCase()) ? ` ${brand.trim()}` : '';
  const tail = catalog === 'catalog_boilers' ? 'Установка и подключение котла от 8 тыс. ₽.' : 'Заказ на сайте или по телефону.';
  const what = `цена, характеристики${area ? `, площадь до ${area} м²` : ''}`;
  for (const where of [' в Болотном, ул. Забабонова, 55А', ' в Болотном']) {
    const d = `${name}${b}${where}: ${what}. ${tail}`;
    if (d.length <= MAX_D) return d;
  }
  return `${name}${b} в Болотном: ${what}.`.slice(0, MAX_D);
}

/** Сохранённое SEO, совпадающее со старым шаблоном (до 24.10.2026), – не ручное: страница берёт новый шаблон. */
export const isOldAutoTitle = (seo: string, title: string) => seo.trim() === `${title.trim()} – купить в Болотном`;
export const isOldAutoDescr = (seo: string, title: string, brand = '') => seo.trim() ===
  `${title.trim()}${brand.trim() ? ` (${brand.trim()})` : ''} в магазине газового оборудования в Болотном, ул. Забабонова, 55А: цена, характеристики, установка и подключение.`;
