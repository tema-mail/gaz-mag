import { useEffect, useState } from 'preact/hooks';
import {
  cart, cartCount, cartTotal, clearCart, favs, fmt, leadItems, leadTopic, removeFromCart, setQty, sheet, toast, toggleFav,
} from '../lib/store';
import { sendForm, thanksUrl } from '../lib/forms';
import { maskPhone, phoneOk } from '../lib/phone';
import { SITE } from '../lib/site';
import { thumb, u } from '../lib/url';
import Drawer from './Drawer';
import Search from './Search';
import LeadPopup from './LeadPopup';
import { IconBag, IconHeart, IconMinus, IconPlus, IconTrash } from './icons';

// Все шторки сайта в одном острове: корзина с оформлением, избранное, поиск, попап заявки, тост «добавлено».
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

/** Оформление в шторке корзины – поля как в корзине Тильды: имя, e-mail, телефон. */
function Checkout() {
  const [f, setF] = useState({ name: '', email: '', phone: '', comment: '' });
  // Согласие на обработку ПДн – отдельной пустой галочкой, кнопка неактивна без неё (КоАП 13.11).
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    setF({ ...f, [k]: k === 'phone' ? maskPhone(v) : v });
    setErr('');
  };
  const submit = async (e: Event) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Укажите имя');
    if (!phoneOk(f.phone)) return setErr('Укажите телефон полностью');
    if (!agree) return setErr('Нужно согласие на обработку персональных данных');
    setBusy(true);
    const order = cart.value.map((i) => `${i.title}${i.variant ? ` (${i.variant})` : ''} – ${i.qty} шт. × ${fmt(i.price)}`).join('\n');
    const ok = await sendForm('Заказ из корзины', {
      Name: f.name, Email: f.email, Phone: f.phone, Comment: f.comment, Order: order, Total: fmt(cartTotal.value),
    }, cart.value.map((i) => ({ uid: i.id, title: i.title, variant: i.variant, category: i.path.split('/')[1] || '', qty: i.qty, price: i.price })));
    setBusy(false);
    if (!ok) return setErr(`Не получилось отправить. Позвоните нам: ${SITE.phones[0].text}`);
    clearCart();
    location.href = thanksUrl();
  };
  return (
    <form class="co" onSubmit={submit} noValidate>
      <p class="co__h">Оформление заказа</p>
      <input class="input" placeholder="Ваше имя" autoComplete="name" value={f.name} onInput={set('name')} aria-label="Ваше имя" />
      <input class="input" type="email" placeholder="Ваш e-mail" autoComplete="email" value={f.email} onInput={set('email')} aria-label="Ваш e-mail" />
      <input class="input" type="tel" inputMode="tel" placeholder="Ваш телефон" autoComplete="tel" value={f.phone} onInput={set('phone')} aria-label="Ваш телефон" />
      <textarea class="input" placeholder="Комментарий: адрес доставки, нужен ли монтаж" value={f.comment} onInput={set('comment')} aria-label="Комментарий" rows={2} />
      <label class="check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree((e.target as HTMLInputElement).checked)} />
        <span>Даю <a href={u('/agreement')} target="_blank">согласие на обработку персональных данных</a> и ознакомлен(а) с <a href={u('/policy')} target="_blank">политикой обработки персональных данных</a></span>
      </label>
      {err && <p class="form-err" role="alert">{err}</p>}
      <div class="cs__total"><span>Итого</span><b>{fmt(cartTotal.value)}</b></div>
      <button class="btn btn--navy btn--block" type="submit" disabled={busy || !agree}>{busy ? 'Отправляем…' : 'Оформить заказ'}</button>
      <p class="form-note">Оформляя заказ, вы принимаете условия <a href={u('/oferta')} target="_blank">договора оферты</a>. Менеджер перезвонит и подтвердит наличие, доставку и оплату.</p>
    </form>
  );
}

function CartSheet() {
  const items = cart.value;
  const close = () => (sheet.value = null);
  return (
    <Drawer
      open={sheet.value === 'cart'}
      onClose={close}
      label="Корзина"
      title={<>Корзина {items.length > 0 && <small>{cartCount.value}</small>}</>}
    >
      {items.length === 0 ? (
        <div class="empty">
          <span class="empty__icon"><IconBag size={30} /></span>
          <p class="empty__title">В корзине пока пусто</p>
          <p>Выберите котёл, водонагреватель или комплектующие в каталоге.</p>
          <a class="btn btn--navy" href={u('/catalogcentr')}>Перейти в каталог</a>
        </div>
      ) : (
        <>
          <ul class="cs__list">
            {items.map((i) => (
              <li class="cs__item">
                <a href={u(i.path)} class="cs__img"><img src={thumb(i.img)} alt="" loading="lazy" /></a>
                <div class="cs__info">
                  <a href={u(i.path)} class="cs__title">{i.title}</a>
                  {i.variant && <span class="cs__variant">{i.variant}</span>}
                  <span class="cs__price">{fmt(i.price * i.qty)}</span>
                  <Qty id={i.id} qty={i.qty} max={i.max} />
                </div>
                <button type="button" class="cs__del" aria-label={`Удалить ${i.title}`} onClick={() => removeFromCart(i.id)}><IconTrash /></button>
              </li>
            ))}
          </ul>
          <Checkout />
        </>
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
    >
      {items.length === 0 ? (
        <div class="empty">
          <span class="empty__icon"><IconHeart size={30} /></span>
          <p class="empty__title">Здесь будут отложенные товары</p>
          <p>Нажмите на сердечко на карточке – товар сохранится, чтобы сравнить и вернуться к нему позже.</p>
          <a class="btn btn--navy" href={u('/catalogcentr')}>Перейти в каталог</a>
        </div>
      ) : (
        <ul class="cs__list">
          {items.map((i) => (
            <li class="cs__item">
              <a href={u(i.path)} class="cs__img"><img src={thumb(i.img)} alt="" loading="lazy" /></a>
              <div class="cs__info">
                <a href={u(i.path)} class="cs__title">{i.title}</a>
                <span class="cs__price">{fmt(i.price)}</span>
                <a class="btn btn--sm btn--outline" href={u(i.path)}>Подробнее</a>
              </div>
              <button type="button" class="cs__del is-fav" aria-label={`Убрать из избранного ${i.title}`} onClick={() => toggleFav(i)}><IconHeart filled size={20} /></button>
            </li>
          ))}
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
      if (!what) {
        leadTopic.value = a.getAttribute('data-lead') || 'Заявка с сайта';
        try { leadItems.value = JSON.parse(a.getAttribute('data-lead-item') || '[]'); } catch { leadItems.value = []; }
      }
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

