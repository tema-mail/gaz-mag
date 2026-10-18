import { signal, computed, effect } from '@preact/signals';

// Корзина и избранное – общие для всех островов страницы и живут между страницами (localStorage).

/** Позиция корзины. id – вариант (edition) или сам товар; variant – «Мощность: 24 кВт». */
export interface CartItem {
  id: string; title: string; price: number; img: string; path: string; qty: number; max?: number | null; variant?: string;
}
export interface FavItem { id: string; title: string; price: number; img: string; path: string; descr?: string }

const CART_KEY = 'gm_cart';
const FAV_KEY = 'gm_fav';
const isBrowser = typeof window !== 'undefined';

function load<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const v = JSON.parse(localStorage.getItem(key) || '');
    return Array.isArray(fallback) && !Array.isArray(v) ? fallback : (v as T);
  } catch { return fallback; }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* приватный режим */ }
}

export const cart = signal<CartItem[]>(load(CART_KEY, []));
export const favs = signal<FavItem[]>(load(FAV_KEY, []));

export const cartCount = computed(() => cart.value.reduce((s, i) => s + i.qty, 0));
export const cartTotal = computed(() => cart.value.reduce((s, i) => s + i.qty * i.price, 0));

// Какие шторки открыты: одна на всю страницу.
export type Sheet = null | 'cart' | 'fav' | 'search' | 'menu' | 'lead' | 'filters';
export const sheet = signal<Sheet>(null);
/** Сообщение-тост после добавления в корзину. */
export const toast = signal<{ text: string; key: number } | null>(null);

if (isBrowser) {
  effect(() => save(CART_KEY, cart.value));
  effect(() => save(FAV_KEY, favs.value));
  // Вторая вкладка поменяла корзину – подтягиваем.
  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY) cart.value = load(CART_KEY, []);
    if (e.key === FAV_KEY) favs.value = load(FAV_KEY, []);
  });
}

export function addToCart(p: Omit<CartItem, 'qty'>, qty = 1) {
  const list = [...cart.value];
  const i = list.findIndex((x) => x.id === p.id);
  const cap = (n: number) => (p.max ? Math.min(n, p.max) : n);
  if (i >= 0) list[i] = { ...list[i], qty: cap(list[i].qty + qty) };
  else list.push({ ...p, qty: cap(qty) });
  cart.value = list;
  toast.value = { text: `«${p.title}» в корзине`, key: Date.now() };
}

export function setQty(id: string, qty: number) {
  cart.value = cart.value
    .map((x) => (x.id === id ? { ...x, qty: x.max ? Math.min(qty, x.max) : qty } : x))
    .filter((x) => x.qty > 0);
}
export const removeFromCart = (id: string) => { cart.value = cart.value.filter((x) => x.id !== id); };
export const clearCart = () => { cart.value = []; };

export const isFav = (id: string) => favs.value.some((x) => x.id === id);
export function toggleFav(p: FavItem) {
  favs.value = isFav(p.id) ? favs.value.filter((x) => x.id !== p.id) : [...favs.value, p];
}

export const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/[\u00a0\u202f]/g, ' ') + ' ₽';

/** Тема заявки для попапа: кнопка с data-lead="Акция …" подставляет её, без значения – общая заявка. */
export const leadTopic = signal('Заявка с сайта');
/** Товар для «Заказать в один клик» (кнопка с data-lead-item) – уходит в заявку отдельным полем. */
export const leadItems = signal<import('./forms').LeadItem[]>([]);
