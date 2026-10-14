import { useEffect, useState } from 'preact/hooks';
import { cartCount, favs, sheet } from '../lib/store';
import { IconBag, IconHeart, IconSearch } from './icons';

// Кнопки шапки: поиск (десктоп), избранное, корзина – со счётчиками.
export default function HeaderActions({ variant }: { variant: 'desktop' | 'mobile' }) {
  // Счётчики из localStorage – только после гидратации, иначе расхождение с HTML сборки.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const fav = ready ? favs.value.length : 0;
  const cnt = ready ? cartCount.value : 0;

  return (
    <div class={`ha ha--${variant}`}>
      {variant === 'desktop' && (
        <button type="button" class="ha__search" onClick={() => (sheet.value = 'search')}>
          <IconSearch size={18} /> <span>Поиск…</span>
        </button>
      )}
      <button type="button" class="icon-btn" aria-label={`Избранное: ${fav}`} onClick={() => (sheet.value = 'fav')}>
        <IconHeart size={20} />
        {fav > 0 && <span class="icon-btn__count">{fav}</span>}
      </button>
      <button type="button" class="icon-btn" aria-label={`Корзина: ${cnt}`} onClick={() => (sheet.value = 'cart')}>
        <IconBag size={20} />
        {cnt > 0 && <span class="icon-btn__count">{cnt}</span>}
      </button>
    </div>
  );
}
