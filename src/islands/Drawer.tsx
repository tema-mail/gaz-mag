import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

// Общая шторка: справа на десктопе, снизу на телефоне. Esc и клик по фону закрывают.
export default function Drawer({ open, onClose, title, children, footer, side = 'right', label }: {
  open: boolean; onClose: () => void; title?: ComponentChildren; children: ComponentChildren;
  footer?: ComponentChildren; side?: 'right' | 'top' | 'center'; label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input, button, a')?.focus(), 60);
    return () => { root.style.overflow = prev; window.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [open]);

  return (
    <div class={`dr dr--${side}${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <div class="dr__bg" onClick={onClose} />
      <div class="dr__panel" ref={ref} role="dialog" aria-modal="true" aria-label={label}>
        {title !== undefined && (
          <div class="dr__head">
            <div class="dr__title">{title}</div>
            <button type="button" class="dr__close" aria-label="Закрыть" onClick={onClose}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        )}
        <div class="dr__body">{children}</div>
        {footer && <div class="dr__foot">{footer}</div>}
      </div>
    </div>
  );
}
