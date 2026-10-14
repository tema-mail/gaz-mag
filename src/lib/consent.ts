// Согласие на cookie (152-ФЗ, ст. 9: согласие – активное действие, а не «пользуясь сайтом, вы соглашаетесь»).
// Необходимые данные (корзина, избранное, сам выбор) хранятся всегда – без них не работает магазин.
// Сервисы Яндекса (карта в «Контактах», она ставит cookie и шлёт статистику на mc.yandex.ru) – только после согласия.
export interface Consent { v: 1; necessary: true; yandex: boolean; at: string }

const KEY = 'gm_consent';
export const CONSENT_EVENT = 'gm-consent';
export const OPEN_EVENT = 'gm-consent-open';

export function readConsent(): Consent | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    return c && c.v === 1 ? c : null;
  } catch { return null; }
}

export function saveConsent(yandex: boolean) {
  const c: Consent = { v: 1, necessary: true, yandex, at: new Date().toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* приватный режим – выбор живёт до закрытия */ }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: c }));
  return c;
}
