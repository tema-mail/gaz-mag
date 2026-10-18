import { useState } from 'preact/hooks';
import { sendForm, thanksUrl, type LeadItem } from '../lib/forms';
import { maskPhone, phoneOk } from '../lib/phone';
import { SITE } from '../lib/site';
import { u } from '../lib/url';

// Общая форма заявки: имя, телефон, согласие. Галочка согласия по умолчанию пустая (КоАП 13.11, 152-ФЗ ст. 9),
// кнопка неактивна, пока её не отметят. Используется в попапе, на «Монтаже», акциях и посадочной.
// extra – скрытые поля (например, ответы квиза), которые уйдут вместе с заявкой.
export default function LeadForm({ form, button = 'Отправить', extra, dark = false, items = [] }: {
  form: string; button?: string; extra?: Record<string, string>; dark?: boolean; items?: LeadItem[];
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!phoneOk(phone)) return setErr('Укажите телефон полностью – менеджер перезвонит');
    if (!agree) return setErr('Нужно согласие на обработку персональных данных');
    setBusy(true);
    const ok = await sendForm(form, { Name: name, Phone: phone, ...extra }, items);
    setBusy(false);
    if (!ok) return setErr(`Не получилось отправить. Позвоните нам: ${SITE.phones[0].text}`);
    location.href = thanksUrl();
  };

  return (
    <form class={`lf${dark ? ' lf--dark' : ''}`} onSubmit={submit} noValidate>
      <label class="field">
        <span class="field__label">Ваше имя</span>
        <input class="input" name="Name" autoComplete="name" placeholder="Как к вам обращаться" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
      <label class="field">
        <span class="field__label">Ваш телефон</span>
        <input
          class={`input${err && !phoneOk(phone) ? ' is-error' : ''}`} type="tel" name="Phone" autoComplete="tel" inputMode="tel"
          placeholder="+7 (___) ___-__-__" value={phone}
          onInput={(e) => { setPhone(maskPhone((e.target as HTMLInputElement).value)); setErr(''); }}
        />
      </label>
      <label class="check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree((e.target as HTMLInputElement).checked)} />
        <span>Даю <a href={u('/agreement')} target="_blank">согласие на обработку персональных данных</a> и ознакомлен(а) с <a href={u('/policy')} target="_blank">политикой обработки персональных данных</a></span>
      </label>
      {err && <p class="form-err" role="alert">{err}</p>}
      <button class={`btn ${dark ? 'btn--white' : 'btn--navy'} btn--block`} type="submit" disabled={busy || !agree}>
        {busy ? 'Отправляем…' : button}
      </button>
    </form>
  );
}
