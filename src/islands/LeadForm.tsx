import { useState } from 'preact/hooks';
import { sendForm, thanksUrl } from '../lib/forms';
import { maskPhone, phoneOk } from '../lib/phone';
import { SITE } from '../lib/site';
import { u } from '../lib/url';

// Общая форма заявки: имя, телефон, согласие. Используется в попапе, на «Монтаже», акциях и посадочной.
// extra – скрытые поля (например, ответы квиза), которые уйдут вместе с заявкой.
export default function LeadForm({ form, button = 'Отправить', extra, dark = false }: {
  form: string; button?: string; extra?: Record<string, string>; dark?: boolean;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!phoneOk(phone)) return setErr('Укажите телефон полностью – менеджер перезвонит');
    if (!agree) return setErr('Нужно согласие на обработку персональных данных');
    setBusy(true);
    const ok = await sendForm(form, { Name: name, Phone: phone, ...extra });
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
        <span>Отправляя форму, вы соглашаетесь с <a href={u('/policy')} target="_blank">политикой конфиденциальности</a></span>
      </label>
      {err && <p class="form-err" role="alert">{err}</p>}
      <button class={`btn ${dark ? 'btn--white' : 'btn--navy'} btn--block`} type="submit" disabled={busy}>
        {busy ? 'Отправляем…' : button}
      </button>
    </form>
  );
}
