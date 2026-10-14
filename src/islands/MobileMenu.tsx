import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { sheet } from '../lib/store';
import { CATALOGS, NAV, SITE, SOCIALS } from '../lib/site';
import { u } from '../lib/url';
import { IconChevron, IconClose, IconPhone, IconSearch, Social } from './icons';

// Мобильное меню: полноэкранная шторка. Сверху каталоги плитками, ниже разделы сайта
// (с подпунктами «Монтажа»), контакты; внизу закреплены «Оставить заявку» и звонок.
export default function MobileMenu() {
  const open = sheet.value === 'menu';
  const [mounted, setMounted] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);

  const close = () => { sheet.value = null; };

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); btnRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    boxRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    return () => { root.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  const links = NAV.filter((n) => n.label !== 'Каталог');

  const panel = (
    <div class={`mm${open ? ' is-open' : ''}`} ref={boxRef} role="dialog" aria-modal="true" aria-label="Меню сайта" aria-hidden={!open}>
      <div class="mm__bar">
        <a class="mm__brand" href={u('/')} onClick={close}>Магазин газового оборудования</a>
        <button type="button" class="mm__close" aria-label="Закрыть меню" onClick={close}><IconClose /></button>
      </div>

      <div class="mm__body">
        <button type="button" class="mm__search" onClick={() => (sheet.value = 'search')}>
          <IconSearch /> <span>Котёл, водонагреватель, счётчик…</span>
        </button>
        <p class="mm__h">Каталог</p>
        <div class="mm__cats">
          <a class="mm-cat mm-cat--all" href={u('/catalogcentr')} onClick={close}>Весь каталог <IconChevron /></a>
          {CATALOGS.map((c) => (
            <a class="mm-cat" href={u('/' + c.slug)} onClick={close}>{c.short} <IconChevron /></a>
          ))}
        </div>
        <ul class="mm__links">
          {links.map((l) => (
            <li>
              {l.children ? (
                <>
                  <button type="button" class="mm__toggle" aria-expanded={openSub === l.label} onClick={() => setOpenSub(openSub === l.label ? null : l.label)}>
                    {l.label} <IconChevron />
                  </button>
                  {openSub === l.label && (
                    <ul class="mm__sub">
                      {l.children.map((c) => <li><a href={u(c.href)} onClick={close}>{c.label}</a></li>)}
                    </ul>
                  )}
                </>
              ) : (
                <a href={l.href.startsWith('#') ? l.href : u(l.href)} onClick={close}>{l.label} <IconChevron /></a>
              )}
            </li>
          ))}
        </ul>
        <div class="mm__contacts">
          {SITE.phones.map((p) => <a class="mm__phone" href={p.href}>{p.text}</a>)}
          <p>{SITE.addressShort}</p>
          <div class="mm__socials">
            {SOCIALS.map((s) => <a href={s.href} target="_blank" rel="noopener nofollow" aria-label={s.label}><Social id={s.id} size={18} /></a>)}
          </div>
        </div>
      </div>

      <div class="mm__cta">
        <button type="button" class="btn btn--navy mm__order" onClick={() => (sheet.value = 'lead')}>Оставить заявку</button>
        <a class="mm__call" href={SITE.phones[0].href} aria-label="Позвонить"><IconPhone /></a>
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
