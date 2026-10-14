import { u } from './url';

// Куда уходят заявки и заказы. Владелец 14.10.2026: «пока никуда – работаем над MVP».
// Пока LEADS_ENABLED = false, формы проверяют поля и ведут на /thanks, но ничего не отправляют.
// Подключение (Тильда, почта, Telegram, CRM) – отдельное решение владельца.
export const LEADS_ENABLED = false;

/** Отправка формы. Сейчас – заглушка без сети: заявка остаётся только в консоли браузера. */
export async function sendForm(formName: string, fields: Record<string, string>): Promise<boolean> {
  if (!LEADS_ENABLED) {
    console.info('[заявки выключены]', formName, fields);
    return true;
  }
  return false;
}

/** Адрес «Спасибо» с учётом подпапки на Pages. */
export const thanksUrl = () => u('/thanks');
