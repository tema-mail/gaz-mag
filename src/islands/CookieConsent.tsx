import { R } from '../lib/routes';
import { useEffect, useRef, useState } from 'preact/hooks';
import { OPEN_EVENT, readConsent, saveConsent } from '../lib/consent';
import { u } from '../lib/url';
import { initMetrika } from '../lib/metrika';

// Окно согласия на cookie – по центру экрана, при первом входе. Три равноценных выбора:
// «Принять все», «Только необходимые», «Настроить». Повторно открывается кнопкой «Настройки cookie» в подвале.
export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [yandex, setYandex] = useState(false);
  const [metrika, setMetrika] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initMetrika(); // счётчик стартует здесь по прошлому согласию или по новому выбору (окно есть на каждой странице)
    const c = readConsent();
    if (!c) setOpen(true); else { setYandex(c.yandex); setMetrika(c.metrika); }
    const reopen = () => { const cur = readConsent(); setYandex(!!cur?.yandex); setMetrika(!!cur?.metrika); setDetails(true); setOpen(true); };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    setTimeout(() => box.current?.querySelector<HTMLElement>('button')?.focus(), 50);
    return () => { root.style.overflow = prev; };
  }, [open]);

  const done = (y: boolean, m: boolean) => { saveConsent(y, m); setYandex(y); setMetrika(m); setOpen(false); setDetails(false); };
  if (!open) return null;

  return (
    <div class="cc" role="dialog" aria-modal="true" aria-labelledby="cc-title">
      <div class="cc__bg" />
      <div class="cc__box" ref={box}>
        <h2 class="cc__title" id="cc-title">Мы используем cookie</h2>
        <p>
          Сайт хранит в вашем браузере корзину, избранное и ваш выбор по cookie – без этого магазин не работает.
          С вашего согласия мы включаем Яндекс Метрику – статистику посещений, чтобы понимать, что на сайте удобно, а что нет,
          и показываем карту Яндекса в «Контактах»: оба сервиса сохраняют свои cookie.
        </p>
        {details && (
          <div class="cc__opts">
            <label class="cc__opt">
              <input type="checkbox" checked disabled />
              <span><b>Необходимые</b> – корзина, избранное, выбор по cookie. Работают всегда.</span>
            </label>
            <label class="cc__opt">
              <input type="checkbox" checked={yandex} onChange={(e) => setYandex((e.target as HTMLInputElement).checked)} />
              <span><b>Сервисы Яндекса</b> – карта проезда в «Контактах» (cookie Яндекса, статистика Яндекс Метрики внутри карты).</span>
            </label>
            <label class="cc__opt">
              <input type="checkbox" checked={metrika} onChange={(e) => setMetrika((e.target as HTMLInputElement).checked)} />
              <span><b>Аналитика</b> – Яндекс Метрика: статистика посещений, карта кликов и запись действий на страницах (Вебвизор). Данные обрабатывает ООО «Яндекс».</span>
            </label>
          </div>
        )}
        <p class="cc__docs">
          Подробнее: <a href={u(R.cookie)}>Политика cookie</a> · <a href={u(R.policy)}>Политика обработки персональных данных</a> · <a href={u(R.agreement)}>Согласие на обработку персональных данных</a>
        </p>
        <div class="cc__btns">
          {details ? (
            <button type="button" class="btn btn--navy" onClick={() => done(yandex, metrika)}>Сохранить выбор</button>
          ) : (
            <button type="button" class="btn btn--navy" onClick={() => done(true, true)}>Принять все</button>
          )}
          <button type="button" class="btn btn--outline" onClick={() => done(false, false)}>Только необходимые</button>
          {!details && <button type="button" class="link cc__set" onClick={() => setDetails(true)}>Настроить</button>}
        </div>
      </div>
    </div>
  );
}
