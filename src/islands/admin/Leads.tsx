import { useEffect, useState } from 'preact/hooks';

/* «Заявки» – перенос с кабинета-стандарта Milovini (доска – эталон ALEX KROWN v1 / EV SIBIR). Магазин без онлайн-оплаты:
   заказ из корзины = заявка (references/contracts.md), у заявки товары и категория – по ним считается спрос.
   Отличие от стенда по данным: у gaz-mag свой приёмник (server/lead.mjs на Beget) – заявки живые: GET /api/leads,
   этап меняется перетаскиванием и сохраняется на сервере (PATCH, история смен). Вход – тот же логин и пароль,
   что у замка кабинета (sessionStorage/localStorage gm_admin_*), второй формы входа нет (правило 17.10.2026). */

export interface LeadItem { uid: string; title: string; variant?: string; category: string; qty: number; price: number }
export interface Lead {
  id: string; createdAt: string; name: string; phone: string; email?: string; form: string; page: string; message?: string;
  stage: 'новая' | 'в работе' | 'выполнена' | 'отказ'; source: string; items: LeadItem[]; category: string;
  history?: { at: string; from: string; to: string }[]; extra?: [string, string][];
}

const STAGES: Lead['stage'][] = ['новая', 'в работе', 'выполнена', 'отказ'];
const STAGE_TITLE: Record<Lead['stage'], string> = { 'новая': 'Новые', 'в работе': 'В работе', 'выполнена': 'Выполнена', 'отказ': 'Отказ' };
const dt = (s: string) => new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Novosibirsk' });
const rub = (n: number) => n.toLocaleString('ru-RU').replace(/[  ]/g, ' ') + ' ₽';
const goods = (l: Lead) => l.items.map((i) => `${i.title}${i.variant ? ` (${i.variant})` : ''}${i.qty > 1 ? ` × ${i.qty}` : ''}`).join(', ');
const sum = (l: Lead) => l.items.reduce((s, i) => s + i.price * i.qty, 0);
const STD = new Set(['Name', 'Phone', 'Email', 'Comment', 'Order', 'Total', 'Page']);

/** Строка leads.jsonl сервера → заявка кабинета. */
function fromServer(r: any): Lead {
  const f = r.fields || {};
  return {
    id: r.id || r.at, createdAt: r.at, name: f.Name || '–', phone: f.Phone || '', email: f.Email, form: r.form, page: f.Page || '',
    message: f.Comment, stage: r.stage || 'новая', source: r.source || 'не определён', items: r.items || [], category: r.category || '',
    history: r.history, extra: Object.entries(f).filter(([k, v]) => !STD.has(k) && v) as [string, string][],
  };
}

/** Вход кабинета из замка – для Basic-авторизации к серверу заявок. */
function auth(): string {
  try {
    const a = JSON.parse(sessionStorage.getItem('gm_admin_auth') || localStorage.getItem('gm_admin_keep') || 'null');
    return a ? 'Basic ' + btoa(unescape(encodeURIComponent(`${a.login}:${a.pass}`))) : '';
  } catch { return ''; }
}

const leadsCsv = (rows: Lead[], cat: (s: string) => string) => {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['номер', 'дата', 'имя', 'телефон', 'почта', 'форма', 'товары', 'категория', 'сумма', 'страница', 'этап', 'источник', 'комментарий'];
  const body = rows.map((l) => [l.id, dt(l.createdAt), l.name, l.phone, l.email ?? '', l.form, goods(l), cat(l.category), sum(l) || '', l.page, STAGE_TITLE[l.stage], l.source, l.message ?? ''].map(q).join(';'));
  return 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + [head.join(';'), ...body].join('\r\n'));
};

function LeadsView({ leads, example, cats: catNames, onStage }: {
  leads: Lead[]; example: boolean; cats: Record<string, string>; onStage: (id: string, stage: Lead['stage']) => Promise<boolean>;
}) {
  const [list, setList] = useState(leads);
  const [q, setQ] = useState('');
  const [src, setSrc] = useState('');
  const [cat, setCat] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [open, setOpen] = useState<Lead | null>(null);
  const [err, setErr] = useState('');
  const catTitle = (s: string) => catNames[s] || s;
  const needle = q.trim().toLowerCase();
  const shown = list.filter((l) => (!src || l.source === src) && (!cat || l.category === cat) && (!needle || [l.id, l.name, l.phone, goods(l)].join(' ').toLowerCase().includes(needle)));
  const cats = [...new Set(list.map((l) => l.category).filter(Boolean))];
  const sources = [...new Set(list.map((l) => l.source))];
  const move = async (id: string, stg: Lead['stage']) => {
    const before = list;
    setList(list.map((x) => (x.id === id ? { ...x, stage: stg } : x)));
    if (example) return;
    setErr('');
    if (!(await onStage(id, stg))) { setList(before); setErr('Этап не сохранился – проверьте связь и попробуйте ещё раз'); }
  };
  const drop = (stg: Lead['stage']) => { if (drag) move(drag, stg); setDrag(null); setOver(null); };
  return (
    <>
      <div class="tools">
        <h1>Заявки {example && <span class="chip">пример</span>}</h1>
        <span class="seg">
          <button class={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Доска</button>
          <button class={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>Списком</button>
        </span>
        <input type="search" placeholder="Номер, имя, телефон, товар" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <select value={cat} onChange={(e) => setCat((e.target as HTMLSelectElement).value)} aria-label="Категория"><option value="">Все категории</option>{cats.map((s) => <option value={s}>{catTitle(s)}</option>)}</select>
        <select value={src} onChange={(e) => setSrc((e.target as HTMLSelectElement).value)} aria-label="Источник"><option value="">Все источники</option>{sources.map((s) => <option>{s}</option>)}</select>
        <a class="btn" href={leadsCsv(shown, catTitle)} download="gaz-mag-leads.csv">⇩ CSV</a>
      </div>
      {err && <p class="demo-note" style="border-color:#e3a5ab;background:#fdf1f2">{err}</p>}
      {view === 'board' ? (
        <div class="kb">
          {STAGES.map((stg) => (
            <section class={`kb__col${over === stg ? ' is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(stg); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); drop(stg); }}>
              <h2>{STAGE_TITLE[stg]} <span>{shown.filter((l) => l.stage === stg).length}</span></h2>
              {shown.filter((l) => l.stage === stg).map((l) => (
                <article class={`kb__card${drag === l.id ? ' is-drag' : ''}`} draggable onDragStart={(e) => { e.dataTransfer?.setData('text/plain', l.id); setDrag(l.id); }} onDragEnd={() => setDrag(null)} onClick={() => setOpen(l)}>
                  <p class="kb__top"><b>№ {l.id}</b><span class="chip">{l.form}</span></p>
                  <p class="kb__who">{l.name} · {l.phone}</p>
                  {l.items.length > 0 && <p class="kb__goods">{goods(l)}{sum(l) > 0 && <> · <b>{rub(sum(l))}</b></>}</p>}
                  {l.category && <p class="muted" style="font-size:12px">Категория: {catTitle(l.category)}</p>}
                  {l.message && <p>{l.message}</p>}
                  <p class="kb__meta"><span>{dt(l.createdAt)}</span><span class="muted">{l.source}</span></p>
                </article>
              ))}
              {shown.filter((l) => l.stage === stg).length === 0 && <p class="muted" style="font-size:12.5px;text-align:center;padding:16px 0">Пусто</p>}
            </section>
          ))}
        </div>
      ) : (
        <div class="tw">
          <table class="vt" style="width:100%">
            <thead><tr><th>Когда</th><th>Имя</th><th>Телефон</th><th>Товары</th><th>Категория</th><th>Форма</th><th>Источник</th><th>Этап</th></tr></thead>
            <tbody>
              {shown.map((l) => <tr onClick={() => setOpen(l)} style="cursor:pointer"><td>{dt(l.createdAt)}</td><td>{l.name}</td><td>{l.phone}</td><td>{goods(l) || <span class="muted">без товара</span>}</td><td>{catTitle(l.category)}</td><td class="muted">{l.form}</td><td class="muted">{l.source}</td><td><span class="chip">{STAGE_TITLE[l.stage]}</span></td></tr>)}
              {!shown.length && <tr><td colSpan={8} class="muted" style="text-align:center;padding:20px">Заявок пока нет</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <div class="ed" role="dialog" aria-modal="true" aria-label={`Заявка № ${open.id}`}>
          <div class="ed__bg" onClick={() => setOpen(null)} />
          <div class="ed__panel ed__panel--narrow">
            <header class="ed__head"><div><p class="muted" style="margin:0;font-size:12px">{open.form} · {dt(open.createdAt)}</p><h2>Заявка № {open.id}</h2></div><button class="btn" onClick={() => setOpen(null)}>Закрыть</button></header>
            <div class="ed__body">
              <table class="vt" style="width:100%"><tbody>
                <tr><th>Имя</th><td>{open.name}</td></tr>
                <tr><th>Телефон</th><td><a href={`tel:${open.phone.replace(/[^\d+]/g, '')}`}>{open.phone}</a></td></tr>
                {open.email && <tr><th>Почта</th><td>{open.email}</td></tr>}
                <tr><th>Товары</th><td>{goods(open) || 'без товара'}{sum(open) > 0 && ` · ${rub(sum(open))}`}</td></tr>
                <tr><th>Категория</th><td>{catTitle(open.category) || '–'}</td></tr>
                {open.message && <tr><th>Комментарий</th><td>{open.message}</td></tr>}
                {(open.extra || []).map(([k, v]) => <tr><th>{k}</th><td>{v}</td></tr>)}
                <tr><th>Страница</th><td>{open.page}</td></tr>
                <tr><th>Источник</th><td>{open.source}</td></tr>
                <tr><th>Этап</th><td><select value={list.find((x) => x.id === open.id)?.stage} onChange={(e) => move(open.id, (e.target as HTMLSelectElement).value as Lead['stage'])}>{STAGES.map((s) => <option value={s}>{STAGE_TITLE[s]}</option>)}</select></td></tr>
                {(open.history || []).length > 0 && <tr><th>История</th><td>{open.history!.map((h) => <div class="muted" style="font-size:12px">{dt(h.at)}: {h.from} → {h.to}</div>)}</td></tr>}
              </tbody></table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Leads({ sample, cats }: { sample: Lead[]; cats: Record<string, string> }) {
  const [state, setState] = useState<{ kind: 'loading' | 'ok' | 'error'; leads: Lead[]; text?: string }>({ kind: 'loading', leads: [] });
  const [example, setExample] = useState(false);
  useEffect(() => {
    fetch('/api/leads', { headers: { Authorization: auth() }, cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) throw new Error('сервер не принял вход кабинета');
        if (!r.ok) throw new Error(`сервер заявок ответил ${r.status}`);
        const d = await r.json();
        const leads = (d.leads || []).map(fromServer);
        setState({ kind: 'ok', leads });
        setExample(!leads.length);
      })
      .catch((e) => { setState({ kind: 'error', leads: [], text: String(e.message || e) }); setExample(true); });
  }, []);
  const onStage = async (id: string, stage: Lead['stage']) => {
    try {
      const r = await fetch(`/api/leads/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Authorization: auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }) });
      return r.ok;
    } catch { return false; }
  };
  if (state.kind === 'loading') return <p class="muted" style="padding:28px">Загружаем заявки…</p>;
  const empty = !state.leads.length;
  return (
    <div>
      {(empty || state.kind === 'error') && (
        <p class="demo-note">
          {state.kind === 'error'
            ? `Заявки с сервера не загрузились: ${state.text}. `
            : 'Заявок с сайта пока нет – они появятся здесь сразу после первого заказа или заявки (и придут в Telegram). '}
          {example && 'Ниже – пример доски на настоящих формах сайта.'}
          <button class="btn" style="margin-left:auto" onClick={() => setExample(!example)}>{example ? 'Скрыть пример' : 'Показать пример'}</button>
        </p>
      )}
      <LeadsView key={String(example)} leads={example ? sample : state.leads} example={example} cats={cats} onStage={onStage} />
    </div>
  );
}
