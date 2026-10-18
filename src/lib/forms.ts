import { R } from './routes';
import { u } from './url';

// Куда уходят заявки и заказы. Владелец 18.10.2026: на боевом gaz-mag.ru – в Telegram через наш приёмник
// на VPS Beget (server/lead.mjs: копия в базу + сообщение в Telegram). Включается только в сборке для Beget
// (PUBLIC_LEADS=1 в .github/workflows/deploy.yml); на копии без сервера формы ничего не отправляют.
export const LEADS_ENABLED = import.meta.env.PUBLIC_LEADS === '1';
const ENDPOINT = '/api/lead';

/** Товар заявки – для вкладки «Заявки» и спроса по товарам: категория = каталог из адреса товара. */
export interface LeadItem { uid: string; title: string; variant?: string; category: string; qty: number; price: number }

/** Источник заявки по первому заходу в этой вкладке: utm_source, поисковик или сайт-реферер, иначе «Прямые заходы». */
function source(): string {
  try {
    const saved = sessionStorage.getItem('gm_src');
    if (saved) return saved;
    const utm = new URLSearchParams(location.search).get('utm_source');
    const ref = document.referrer ? new URL(document.referrer).hostname : '';
    const s = utm ? `Реклама: ${utm}`
      : /yandex\./.test(ref) ? 'Поиск Яндекса' : /google\./.test(ref) ? 'Поиск Google'
      : /(vk\.com|t\.me|telegram|ok\.ru|instagram)/.test(ref) ? 'Соцсети и мессенджеры'
      : ref && !ref.endsWith(location.hostname) ? `Сайт ${ref}` : 'Прямые заходы';
    sessionStorage.setItem('gm_src', s);
    return s;
  } catch { return ''; }
}
if (typeof window !== 'undefined') source();

/**
 * Отправка формы. Вызывается только после отмеченной галочки согласия – поэтому consent: true;
 * сервер без согласия заявку не примет (152-ФЗ, ст. 9).
 */
export async function sendForm(formName: string, fields: Record<string, string>, items: LeadItem[] = []): Promise<boolean> {
  if (!LEADS_ENABLED) {
    console.info('[заявки выключены]', formName, fields, items);
    return true;
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form: formName, consent: true, source: source(), items, fields: { ...fields, Page: location.pathname } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Адрес «Спасибо» с учётом подпапки на Pages. */
export const thanksUrl = () => u(R.thanks);
