import { useEffect, useState } from 'preact/hooks';
import {
  addToCart, cart, cartCount, cartTotal, favs, fmt, removeFromCart, setQty, sheet, toast, toggleFav,
} from '../lib/store';
import { FREE_FROM } from '../lib/delivery';
import { u } from '../lib/url';
import Drawer from './Drawer';
import Search from './Search';
import LeadPopup from './LeadPopup';
import { IconBag, IconHeart, IconMinus, IconPlus, IconTrash } from './icons';

// Все шторки сайта в одном острове: корзина, избранное, поиск, попап заявки, тост «добавлено».
// Кнопки с data-lead или href="#popup:myform" в любом месте страницы открывают попап заявки.

function Qty({ id, qty, max }: { id: string; qty: number; max?: number | null }) {
  return (
    <div class="qty">
      <button type="button" aria-label="Меньше" onClick={() => setQty(id, qty - 1)}><IconMinus /></button>
      <span>{qty}</span>
      <button type="button" aria-label="Больше" disabled={!!max && qty >= max} onClick={() => setQty(id, qty + 1)}><IconPlus /></button>
    </div>
  );
}

function CartSheet() {
  const items = cart.value;
  const total = cartTotal.value;
  const left = Math.max(0, FREE_FROM - total);
  const close = () => (sheet.value = null);
  return (
    <Drawer
      open={sheet.value === 'cart'}
      onClose={close}
      label="Корзина"
      title={<>Корзина {items.length > 0 && <small>{cartCount.value}</small>}</>}
      footer={items.length > 0 && (
        <>
          <div class="cs__free">
            {left > 0 ? (
              <span>До бесплатной доставки по центру – <b>{fmt(left)}</b></span>
            ) : (
              <span>Доставка по центральным районам – <b>бесплатно</b></span>
            )}
            <i style={{ '--p': `${Math.min(100, (total / FREE_FROM) * 100)}%` }} />
          </div>
          <div class="cs__total"><span>Итого</span><b>{fmt(total)}</b></div>
          <a class="btn btn--mauve btn--block" href={u('/order')}>Оформить заказ</a>
          <button type="button" class="cs__more" onClick={close}>Продолжить покупки</button>
        </>
      )}
    >
      {items.length === 0 ? (
        <div class="empty">
          <span class="empty__icon"><IconBag size={30} /></span>
          <p class="empty__title">В корзине пока пусто</p>
          <p>Выберите букет в каталоге – флорист соберёт его и пришлёт фото перед доставкой.</p>
          <a class="btn btn--pink" href={u('/catalog')}>Перейти в каталог</a>
        </div>
      ) : (
        <ul class="cs__list">
          {items.map((i) => (
            <li class="cs__item">
              <a href={u(i.path)} class="cs__img"><img src={u(i.img + '-480.webp')} alt="" loading="lazy" /></a>
              <div class="cs__info">
                <a href={u(i.path)} class="cs__title">{i.title}</a>
                <span class="cs__price">{fmt(i.price * i.qty)}</span>
                <Qty id={i.id} qty={i.qty} max={i.max} />
              </div>
              <button type="button" class="cs__del" aria-label={`Удалить ${i.title}`} onClick={() => removeFromCart(i.id)}><IconTrash /></button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

function FavSheet() {
  const items = favs.value;
  return (
    <Drawer
      open={sheet.value === 'fav'}
      onClose={() => (sheet.value = null)}
      label="Избранное"
      title={<>Избранное {items.length > 0 && <small>{items.length}</small>}</>}
      footer={items.length > 0 && <a class="btn btn--outline btn--block" href={u('/favorites')}>Открыть страницу избранного</a>}
    >
      {items.length === 0 ? (
        <div class="empty">
          <span class="empty__icon"><IconHeart size={30} /></span>
          <p class="empty__title">Здесь будут понравившиеся букеты</p>
          <p>Нажмите на сердечко на карточке – букет сохранится, чтобы вернуться к нему позже.</p>
          <a class="btn btn--pink" href={u('/catalog')}>Перейти в каталог</a>
        </div>
      ) : (
        <ul class="cs__list">
          {items.map((i) => {
            const inCart = cart.value.some((c) => c.id === i.id);
            return (
              <li class="cs__item">
                <a href={u(i.path)} class="cs__img"><img src={u(i.img + '-480.webp')} alt="" loading="lazy" /></a>
                <div class="cs__info">
                  <a href={u(i.path)} class="cs__title">{i.title}</a>
                  <span class="cs__price">{fmt(i.price)}</span>
                  <button
                    type="button"
                    class={`btn btn--sm ${inCart ? 'btn--outline' : 'btn--pink'}`}
                    onClick={() => (inCart ? (sheet.value = 'cart') : addToCart({ id: i.id, title: i.title, price: i.price, img: i.img, path: i.path }))}
                  >
                    {inCart ? 'В корзине' : 'В корзину'}
                  </button>
                </div>
                <button type="button" class="cs__del is-fav" aria-label={`Убрать из избранного ${i.title}`} onClick={() => toggleFav(i)}><IconHeart filled size={20} /></button>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}

function Toast() {
  const t = toast.value;
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!t) return;
    setShow(true);
    const id = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(id);
  }, [t?.key]);
  if (!t) return null;
  return (
    <div class={`toast${show && sheet.value === null ? ' is-show' : ''}`} role="status">
      <span>{t.text}</span>
      <button type="button" onClick={() => { setShow(false); sheet.value = 'cart'; }}>Открыть</button>
    </div>
  );
}

export default function Sheets() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('[data-lead], a[href="#popup:myform"], [data-open]') as HTMLElement | null;
      if (!a) return;
      e.preventDefault();
      const what = a.getAttribute('data-open');
      sheet.value = (what as any) || 'lead';
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <>
      <CartSheet />
      <FavSheet />
      <Search />
      <LeadPopup />
      <Toast />
    </>
  );
}
