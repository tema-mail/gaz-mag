import { useEffect, useState } from 'preact/hooks';
import type { Card } from '../lib/catalog';
import { addToCart, cart, favs, fmt, sheet, toggleFav } from '../lib/store';
import { thumb, u } from '../lib/url';
import { IconHeart } from './icons';

// Карточка товара в сетках – как на оригинале: фото на белом, название, цена, сердечко.
// Товар с вариантами (мощность, объём) ведёт на страницу выбрать вариант, без вариантов – сразу в корзину.
export default function ProductCard({ p, eager = false, cta = 'Подробнее' }: { p: Card; eager?: boolean; cta?: string }) {
  // Состояние «в корзине / в избранном» – только после гидратации (в HTML сборки его нет).
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const fav = ready && favs.value.some((x) => x.id === p.id);
  const inCart = ready && cart.value.some((x) => x.id === p.id);
  const href = u(p.path);
  const item = { id: p.id, title: p.title, price: p.price, img: p.img, path: p.path };

  return (
    <article class="pc">
      <a class="pc__media" href={href} aria-label={p.title}>
        <img
          class="pc__img" src={thumb(p.img)} srcset={p.img ? `${thumb(p.img)} 480w, ${thumb(p.img, 1000)} 1000w` : undefined}
          sizes="(max-width: 1023px) 50vw, 300px" alt={p.title} loading={eager ? 'eager' : 'lazy'} decoding="async"
        />
      </a>
      <button
        type="button" class={`pc__fav${fav ? ' is-on' : ''}`} aria-pressed={fav}
        aria-label={fav ? 'Убрать из избранного' : 'В избранное'}
        onClick={() => toggleFav(item)}
      >
        <IconHeart filled={fav} size={20} />
      </button>
      <div class="pc__body">
        <a class="pc__title" href={href}>{p.title}</a>
        <div class="pc__price">
          {p.variants && <span>от</span>}
          <b>{fmt(p.price)}</b>
          {p.priceOld && <s>{fmt(p.priceOld)}</s>}
        </div>
        <div class="pc__actions">
          {p.variants ? (
            <a class="btn btn--sm btn--navy" href={href}>{cta}</a>
          ) : (
            <button
              type="button" class={`btn btn--sm ${inCart ? 'btn--outline' : 'btn--navy'}`}
              onClick={() => (inCart ? (sheet.value = 'cart') : addToCart(item))}
            >
              {inCart ? 'В корзине' : 'В корзину'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
