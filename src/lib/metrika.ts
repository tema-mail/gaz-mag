import { CONSENT_EVENT, readConsent } from './consent';
import { PROD } from './stage';

// Яндекс Метрика gaz-mag.ru – счётчик 97249745 (владелец 21.10.2026: «привязать к сайту заново»).
// 152-ФЗ: счётчик грузится только после согласия на «Аналитику» в окне cookie и только на боевом домене –
// до согласия Яндекс ничего не получает, цели и события электронной коммерции молча пропускаются.
// Цели (JS-цели с этими идентификаторами заводятся в самой Метрике): lead – отправлена форма заявки,
// order – оформлен заказ из корзины, cart_add – товар в корзине, phone_click – нажали на телефон,
// messenger_click – Telegram, WhatsApp или ВКонтакте. Имена lead / phone_click / messenger_click – как у EV SIBIR,
// чтобы раздел «Метрика и каналы» кабинета брал их без подмены.
export const METRIKA_ID = 97249745;

declare global { interface Window { ym?: (...a: unknown[]) => void; dataLayer?: unknown[] } }

let started = false;
/** Счётчик запущен или его можно запустить сейчас (согласие уже дано, а окно cookie ещё не успело вызвать initMetrika). */
const on = () => started || (!!readConsent()?.metrika && (start(), started));
function start() {
  if (started || !PROD || location.hostname !== 'gaz-mag.ru') return;
  started = true;
  window.dataLayer = window.dataLayer || [];
  const w = window as any;
  w.ym = w.ym || function (...a: unknown[]) { (w.ym.a = w.ym.a || []).push(a); };
  w.ym.l = Date.now();
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.appendChild(s);
  w.ym(METRIKA_ID, 'init', { webvisor: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, ecommerce: 'dataLayer' });
}

/** Цель Метрики – только если счётчик запущен (есть согласие). */
export function goal(name: string) {
  if (!on()) return;
  try { window.ym?.(METRIKA_ID, 'reachGoal', name); } catch { /* счётчик не загрузился – без цели */ }
}

export interface EcomProduct { id: string; name: string; price: number; brand?: string; category?: string; variant?: string; quantity?: number }
/** Событие электронной коммерции (detail – просмотр карточки, add – в корзину, purchase – заказ). */
export function ecom(action: 'detail' | 'add' | 'remove' | 'purchase', products: EcomProduct[], orderId?: string) {
  if (!on() || !window.dataLayer) return;
  window.dataLayer.push({ ecommerce: { currencyCode: 'RUB', [action]: { ...(orderId ? { actionField: { id: orderId } } : {}), products } } });
}

let inited = false;
/** Вызывается один раз на странице (окно cookie): запуск по прошлому согласию или по новому выбору, цели кликов. */
export function initMetrika() {
  if (inited || typeof window === 'undefined') return;
  inited = true;
  if (readConsent()?.metrika) start();
  window.addEventListener(CONSENT_EVENT, (e) => { if ((e as CustomEvent).detail?.metrika) start(); });
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a');
    const h = a?.getAttribute('href') || '';
    if (h.startsWith('tel:')) goal('phone_click');
    else if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|t\.me|vk\.com)\//.test(h)) goal('messenger_click');
  }, true);
}
