// Отправка форм в приёмник Тильды – те же получатели (formservices), что на живом milovinisamara.ru,
// поэтому заявки и заказы приходят туда же, куда сейчас. Список снят из форм сайта 13.10.2026.
export const FORM_ACTION = 'https://forms.tildacdn.com/procces/';
export const FORM_SERVICES = [
  'd9f103ba2ffa8dd95c92416c99770283',
  'db9c228c7af0d4ba79e3f61c9430dd7a',
  '299ffaf059b9db584cefba548b75d0c4',
];
export const TILDA = { projectId: '33165509', pageId: '199861909', formsKey: '14683579f32d09a74ffe9fac33165509' };

/**
 * Шлёт поля формы. Приёмник Тильды не отдаёт CORS-заголовки, поэтому запрос no-cors:
 * ответ не читается, успехом считаем то, что запрос ушёл без сетевой ошибки.
 */
export async function sendForm(formName: string, fields: Record<string, string>): Promise<boolean> {
  const body = new URLSearchParams();
  FORM_SERVICES.forEach((s) => body.append('formservices[]', s));
  body.append('tildaspec-formname', formName);
  body.append('tildaspec-projectid', TILDA.projectId);
  body.append('tildaspec-pageid', TILDA.pageId);
  body.append('tildaspec-formskey', TILDA.formsKey);
  body.append('tildaspec-referer', location.href);
  for (const [k, v] of Object.entries(fields)) if (v) body.append(k, v);
  try {
    await fetch(FORM_ACTION, { method: 'POST', mode: 'no-cors', body });
    return true;
  } catch {
    return false;
  }
}

import { u } from './url';
/** Адрес «Спасибо» с учётом подпапки на Pages. */
export const thanksUrl = () => u('/thanks');
