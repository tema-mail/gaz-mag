import productsJson from '../data/products.json';
import filtersJson from '../data/filters.json';

export interface Edition { id: string; price: number | null; priceOld: number | null; opts: Record<string, string> }
export interface Product {
  id: string;
  path: string;
  title: string;
  brand: string;
  descr: string;
  text: string;
  price: number | null;
  priceOld: number | null;
  sort: number;
  /** Части магазина (ключи STOREPARTS в scripts/fetch-data.mjs), где товар показан. */
  lists: string[];
  chars: { t: string; v: string }[];
  options: { title: string; values: string[] }[];
  editions: Edition[];
  images: string[];
  /** Поля, которые пишет админка (src/islands/admin/ProductsAdmin.tsx). */
  hidden?: boolean; sku?: string; mark?: string; seoTitle?: string; seoDescr?: string;
}

/** Карточка товара для островов: только то, что нужно сетке, фильтрам и корзине. */
export interface Card {
  id: string; path: string; title: string; brand: string; descr: string;
  price: number; priceOld: number | null; img: string; sort: number;
  /** Характеристики для фильтров: название → значение. */
  ch: Record<string, string>;
  /** Мощности для фильтра «Мощность», например «13 кВт». */
  power: string[];
  /** Есть варианты – из карточки каталога ведём на страницу товара выбрать вариант. */
  variants: boolean;
}

export type FilterKind = 'brand' | 'price' | 'char' | 'power';
export interface FilterDef { label: string; kind: FilterKind; char?: string }

// Все товары с ценой (для админки – включая скрытые). У 16 товаров «Радиаторы и иные товары» на оригинале нет фото – с заглушкой.
export const allProducts = (productsJson as Product[]).filter((p) => p.price);
/** Товары на сайте: скрытые в админке не попадают в каталоги, поиск, sitemap и не получают страницу. */
export const products = allProducts.filter((p) => !p.hidden);
export const productById = new Map(products.map((p) => [p.id, p]));

/** «10кВт», «13 кВт», «24» → «10 кВт». */
const kw = (s: string) => {
  const m = s.replace(',', '.').match(/\d+(\.\d+)?/);
  return m ? `${m[0]} кВт` : '';
};

function powers(p: Product): string[] {
  const opt = p.options.find((o) => /мощность/i.test(o.title));
  if (opt) return opt.values.map(kw).filter(Boolean);
  const c = p.chars.find((x) => /^мощность/i.test(x.t));
  return c && /^\d+([.,]\d+)?\s*(квт)?\.?$/i.test(c.v.trim()) ? [kw(c.v)] : [];
}

export const toCard = (p: Product): Card => ({
  id: p.id, path: p.path, title: p.title, brand: p.brand, descr: p.descr,
  price: Math.min(p.price ?? 0, ...p.editions.map((e) => e.price ?? Infinity)), priceOld: p.priceOld, img: p.images[0] ?? '', sort: p.sort,
  ch: Object.fromEntries(p.chars.map((c) => [c.t, c.v])),
  power: powers(p),
  variants: p.editions.length > 1,
});

/** Товары части магазина в порядке Тильды. */
export function listCards(list: string): Card[] {
  return products.filter((p) => p.lists.includes(list)).sort((a, b) => a.sort - b.sort).map(toCard);
}

/**
 * Фильтры каталога – те, что владелец включил в Тильде (src/data/filters.json).
 * «Мощность» на Тильде смотрела только на вариант с названием ровно «Мощность» (один котёл);
 * у нас она собирает мощность из всех вариантов и характеристик, иначе фильтр почти пустой.
 */
export function filterDefs(list: string): FilterDef[] {
  const raw = (filtersJson as Record<string, { label: string; name: string }[]>)[list] || [];
  return raw.map((f) => {
    if (f.name === 'brand') return { label: f.label, kind: 'brand' };
    if (f.name === 'price') return { label: f.label, kind: 'price' };
    if (f.name.startsWith('option:')) return { label: f.label, kind: 'power' };
    return { label: f.label, kind: 'char', char: f.label };
  });
}

/** Карточка товара: каталог, к которому он относится по адресу оригинала. */
export const catalogOf = (p: Product) => p.path.split('/')[1];

export const rub = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';
