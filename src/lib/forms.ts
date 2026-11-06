import { R } from './routes';
import { u } from './url';
import { ecom, goal } from './metrika';
import { leadFields } from './attribution';

// Куда уходят заявки и заказы. Владелец 18.10.2026: на боевом gaz-mag.ru – в Telegram через наш приёмник
// на VPS Beget (server/lead.mjs: копия в базу + сообщение в Telegram). Включается только в сборке для Beget
// (PUBLIC_LEADS=1 в .github/workflows/deploy.yml); на копии без сервера формы ничего не отправляют.
export const LEADS_ENABLED = import.meta.env.PUBLIC_LEADS === '1';
const ENDPOINT = '/api/lead';

/** Товар заявки – для вкладки «Заявки» и спроса по товарам: категория = каталог из адреса товара. */
export interface LeadItem { uid: string; title: string; variant?: string; category: string; qty: number; price: number }

/**
 * Отправка формы. Вызывается только после отмеченной галочки согласия – поэтому consent: true;
 * сервер без согласия заявку не примет (152-ФЗ, ст. 9).
 */
export async function sendForm(formName: string, fields: Record<string, string>, items: LeadItem[] = []): Promise<boolean> {
  if (!LEADS_ENABLED) {
    console.info('[заявки выключены]', formName, fields, items);
    return true;
  }
  const { 'Источник': source, 'Страница заявки': _page, ...rest } = leadFields();
  const extra = { 'Источник': source, ...rest };
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form: formName, consent: true, source, items, fields: { ...fields, ...extra, Page: location.pathname } }),
    });
    if (res.ok) {
      // цели Метрики (только при согласии на аналитику): любая отправка – lead, заказ из корзины – ещё order и покупка
      goal('lead');
      if (formName === 'Заказ из корзины') {
        goal('order');
        ecom('purchase', items.map((i) => ({ id: i.uid, name: i.title, price: i.price, variant: i.variant, category: i.category, quantity: i.qty })), `gm-${Date.now()}`);
      }
    }
    return res.ok;
  } catch {
    return false;
  }
}

/** Адрес «Спасибо» с учётом подпапки на Pages. */
export const thanksUrl = () => u(R.thanks);
