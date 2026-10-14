import { useEffect, useState } from 'preact/hooks';
import { cartCount, favs, sheet } from '../lib/store';
import { IconBag, IconHeart, IconSearch } from './icons';

// Кнопки шапки: поиск, избранное, корзина – со счётчиками.
export default function HeaderActions({ variant }: { variant: 'desktop' | 'mobile' }) {
  // Счётчики из localStorage – только после гидратации, иначе расхождение с HTML сборки.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const fav = ready ? favs.value.length : 0;
  const cnt = ready ? cartCount.value : 0;
  const cls = variant === 'mobile' ? 'icon-btn icon-btn--light' : 'icon-btn';

  return (
    <div class={`ha ha--${variant}`}>
      <button type="button" class={cls} aria-label="Поиск по каталогу" onClick={() => (sheet.value = 'search')}>
        <IconSearch size={18} />
      </button>
      <button type="button" class={cls} aria-label={`Избранное: ${fav}`} onClick={() => (sheet.value = 'fav')}>
        <IconHeart size={18} />
        {fav > 0 && <span class="icon-btn__count">{fav}</span>}
      </button>
      <button type="button" class={cls} aria-label={`Корзина: ${cnt}`} onClick={() => (sheet.value = 'cart')}>
        <IconBag size={18} />
        {cnt > 0 && <span class="icon-btn__count">{cnt}</span>}
      </button>
    </div>
  );
}
