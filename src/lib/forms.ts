import { u } from './url';

// Куда уходят заявки и заказы. Владелец 18.10.2026: на боевом gaz-mag.ru – в Telegram через наш приёмник
// на VPS Beget (server/lead.mjs: копия в базу + сообщение в Telegram). Включается только в сборке для Beget
// (PUBLIC_LEADS=1 в .github/workflows/deploy.yml); на копии без сервера формы ничего не отправляют.
export const LEADS_ENABLED = import.meta.env.PUBLIC_LEADS === '1';
const ENDPOINT = '/api/lead';

/**
 * Отправка формы. Вызывается только после отмеченной галочки согласия – поэтому consent: true;
 * сервер без согласия заявку не примет (152-ФЗ, ст. 9).
 */
export async function sendForm(formName: string, fields: Record<string, string>): Promise<boolean> {
  if (!LEADS_ENABLED) {
    console.info('[заявки выключены]', formName, fields);
    return true;
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form: formName, consent: true, fields: { ...fields, Page: location.pathname } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Адрес «Спасибо» с учётом подпапки на Pages. */
export const thanksUrl = () => u('/thanks');
