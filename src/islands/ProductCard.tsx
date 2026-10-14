import { useEffect, useState } from 'preact/hooks';
import type { Card } from '../lib/catalog';
import { addToCart, cart, favs, fmt, sheet, toggleFav } from '../lib/store';
import { u } from '../lib/url';
import { IconBag, IconHeart } from './icons';

// Карточка товара в сетках. Сердечко – в избранное, «В корзину» – сразу в корзину.
export default function ProductCard({ p, eager = false }: { p: Card; eager?: boolean }) {
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
          class="pc__img" src={u(p.img + '-480.webp')} srcset={`${u(p.img + '-480.webp')} 480w, ${u(p.img + '-1000.webp')} 1000w`}
          sizes="(max-width: 1023px) 50vw, 25vw" alt={p.title} loading={eager ? 'eager' : 'lazy'} decoding="async"
        />
        {p.img2 && <img class="pc__img2" src={u(p.img2 + '-480.webp')} alt="" loading="lazy" decoding="async" />}
        {p.mark && <span class="pc__mark">{p.mark}</span>}
      </a>
      <button
        type="button" class={`pc__fav${fav ? ' is-on' : ''}`} aria-pressed={fav}
        aria-label={fav ? 'Убрать из избранного' : 'В избранное'}
        onClick={() => toggleFav({ ...item, descr: p.descr })}
      >
        <IconHeart filled={fav} size={20} />
      </button>
      <div class="pc__body">
        <a class="pc__title" href={href}>{p.title}</a>
        {p.descr && <p class="pc__descr">{p.descr}</p>}
        <div class="pc__price">
          <b>{fmt(p.price)}</b>
          {p.priceOld && <s>{fmt(p.priceOld)}</s>}
        </div>
        <div class="pc__actions">
          <button
            type="button" class={`btn btn--sm ${inCart ? 'btn--outline' : 'btn--pink'} pc__buy`}
            onClick={() => (inCart ? (sheet.value = 'cart') : addToCart({ ...item, max: p.stock }))}
          >
            <IconBag size={16} /> <span>{inCart ? 'В корзине' : 'В корзину'}</span>
          </button>
          <a class="btn btn--sm btn--outline pc__more" href={href}>Подробнее</a>
        </div>
      </div>
    </article>
  );
}
