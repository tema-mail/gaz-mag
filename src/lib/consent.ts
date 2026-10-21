// Согласие на cookie (152-ФЗ, ст. 9: согласие – активное действие, а не «пользуясь сайтом, вы соглашаетесь»).
// Необходимые данные (корзина, избранное, сам выбор) хранятся всегда – без них не работает магазин.
// Сервисы Яндекса (карта в «Контактах», она ставит cookie и шлёт статистику на mc.yandex.ru) – только после согласия.
// Аналитика (Яндекс Метрика сайта, src/lib/metrika.ts) – отдельная галочка, тоже только после согласия.
// v2 (21.10.2026): добавлена «Аналитика» – выбор v1 о ней не спрашивал, поэтому окно показывается заново.
export interface Consent { v: 2; necessary: true; yandex: boolean; metrika: boolean; at: string }

const KEY = 'gm_consent';
export const CONSENT_EVENT = 'gm-consent';
export const OPEN_EVENT = 'gm-consent-open';

export function readConsent(): Consent | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    return c && c.v === 2 ? c : null;
  } catch { return null; }
}

/** metrika не передан (кнопка «Показать карту» в «Контактах») – прежний выбор по аналитике сохраняется. */
export function saveConsent(yandex: boolean, metrika = readConsent()?.metrika ?? false) {
  const c: Consent = { v: 2, necessary: true, yandex, metrika, at: new Date().toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* приватный режим – выбор живёт до закрытия */ }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: c }));
  return c;
}
