import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { sheet } from '../lib/store';
import { SITE, SOCIALS } from '../lib/site';
import { u } from '../lib/url';
import type { MenuTile } from '../lib/menu';
import { IconArrow, IconChevron, IconClose, IconFlower, IconPhone, IconSearch, Social } from './icons';

// Мобильное меню по образцу EV Sibir: полноэкранная шторка, плитки разделов с фото,
// раздел раскрывается в подразделы; внизу всегда закреплена «Заказать букет».

const LINKS = [
  { label: 'Каталог цветов', href: '/catalog' },
  { label: 'Акции', href: '/akcii' },
  { label: 'Корпоративным клиентам', href: '/corparate' },
  { label: 'Доставка и оплата 24/7', href: '/delivery' },
  { label: 'Гарантии', href: '/garantee' },
  { label: 'Отзывы', href: '/#rev' },
  { label: 'О компании', href: '/about' },
  { label: 'Контакты', href: '/contact' },
];

const plural = (n: number) => {
  const t = n % 10, h = n % 100;
  if (t === 1 && h !== 11) return `${n} товар`;
  if (t >= 2 && t <= 4 && (h < 10 || h >= 20)) return `${n} товара`;
  return `${n} товаров`;
};

export default function MobileMenu({ tiles }: { tiles: MenuTile[] }) {
  const open = sheet.value === 'menu';
  const [drill, setDrill] = useState<MenuTile | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);

  const close = () => { sheet.value = null; };

  useEffect(() => {
    if (!open) { setDrill(null); return; }
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); btnRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    boxRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    return () => { root.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  const panel = (
    <div class={`mm${open ? ' is-open' : ''}`} ref={boxRef} role="dialog" aria-modal="true" aria-label="Меню сайта" aria-hidden={!open}>
      <div class="mm__bar">
        {drill ? (
          <button type="button" class="mm__back" onClick={() => setDrill(null)}>
            <IconChevron back /> <span>{drill.title}</span>
          </button>
        ) : (
          <a class="mm__logo" href={u('/')} onClick={close}><img src={u('/img/logo.svg')} alt="Milovini Flowers" /></a>
        )}
        <button type="button" class="mm__close" aria-label="Закрыть меню" onClick={close}><IconClose /></button>
      </div>

      <div class="mm__body">
        {!drill ? (
          <>
            <button type="button" class="mm__search" onClick={() => (sheet.value = 'search')}>
              <IconSearch /> <span>Найти букет, цветок, повод…</span>
            </button>
            <div class="mm__tiles">
              {tiles.map((t, i) => {
                const inner = (
                  <>
                    {t.img && <img src={t.img} alt="" loading="lazy" />}
                    <span class="mm-tile__shade" />
                    <span class="mm-tile__text">
                      <span class="mm-tile__title">{t.title}</span>
                      <span class="mm-tile__meta">{plural(t.count)}</span>
                    </span>
                    <span class="mm-tile__arrow">{t.children.length ? <IconChevron /> : <IconArrow size={16} />}</span>
                  </>
                );
                return t.children.length ? (
                  <button type="button" class={`mm-tile${i < 2 ? ' mm-tile--big' : ''}`} onClick={() => setDrill(t)}>{inner}</button>
                ) : (
                  <a class="mm-tile" href={t.href} onClick={close}>{inner}</a>
                );
              })}
            </div>
            <ul class="mm__links">
              {LINKS.map((l) => (
                <li><a href={u(l.href)} onClick={close}>{l.label} <IconChevron /></a></li>
              ))}
            </ul>
            <div class="mm__contacts">
              <a class="mm__phone" href={SITE.phoneHref}>{SITE.phone}</a>
              <p>{SITE.city}, {SITE.address} · {SITE.hours.toLowerCase()}</p>
              <div class="mm__socials">
                {SOCIALS.map((s) => <a href={s.href} target="_blank" rel="noopener" aria-label={s.label}><Social id={s.id} size={18} /></a>)}
              </div>
            </div>
          </>
        ) : (
          <>
            <a class="mm-hero" href={drill.href} onClick={close}>
              {drill.img && <img src={drill.img} alt="" />}
              <span class="mm-tile__shade" />
              <span class="mm-hero__text">{drill.title}<small>{plural(drill.count)} · смотреть все</small></span>
            </a>
            <ul class="mm__links mm__links--sub">
              {drill.children.map((c) => (
                <li><a href={c.href} onClick={close}>{c.title} <IconChevron /></a></li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div class="mm__cta">
        <button type="button" class="btn btn--mauve mm__order" onClick={() => (sheet.value = 'lead')}>
          Заказать букет <IconFlower />
        </button>
        <a class="mm__call" href={SITE.phoneHref} aria-label="Позвонить"><IconPhone /></a>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        class={`icon-btn mm-burger${open ? ' is-open' : ''}`}
        aria-label="Меню"
        aria-expanded={open}
        onClick={() => (sheet.value = open ? null : 'menu')}
      >
        <span /><span /><span />
      </button>
      {mounted && createPortal(panel, document.body)}
    </>
  );
}
