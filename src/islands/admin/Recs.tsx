// «Рекомендации» кабинета gaz-mag – открыты владельцем 21.10.2026. Источник – прогон агента улучшений
// (~/.claude/skills/uluchsheniya: uluchsheniya.json → analytics/collect.py recommendations → /api/admin/report/recommendations).
// Вид – страница прогона агента (uluchsheniya.html, svod.py) один в один; кнопки «В работу / Сделано / Не надо» здесь живые:
// PATCH /api/admin/recommendations/<id>, агент при следующем прогоне видит статус и не поднимает «не надо» снова.
import { useEffect, useState } from 'preact/hooks';
import { adminAuth } from './auth';

type Item = { id: string; zagolovok: string; chto: string; pochemu_vazhno: string; dokazatelstvo: string; kak_ispravit: string;
  kto: string; oblast: string; prioritet: 'srochno' | 'vazhno' | 'mozhno'; usilie: string; istochnik: string; status: string;
  vpervye: string; posledniy_raz: string; status_at?: string };
type Data = { sayt: string; data: string; items: Item[] };

const PR: Record<string, string> = { srochno: 'Срочно', vazhno: 'Важно', mozhno: 'Можно' };
const ST: Record<string, string> = { novoe: 'новое', v_rabote: 'в работе', sdelano: 'сделано', ne_nado: 'не надо' };
const ORDER = ['srochno', 'vazhno', 'mozhno'];
const BTN: [string, string][] = [['v_rabote', 'В работу'], ['sdelano', 'Сделано'], ['ne_nado', 'Не надо']];

export default function Recs() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    fetch('/api/admin/report/recommendations', { headers: { Authorization: adminAuth() }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 404 ? 'прогона агента улучшений ещё не было' : `сервер ответил ${r.status}`))))
      .then(setD, (e) => setErr(`Рекомендации не загрузились: ${e.message}`));
  }, []);

  const mark = async (id: string, status: string) => {
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/recommendations/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { Authorization: adminAuth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setD((cur) => cur && { ...cur, items: cur.items.map((i) => (i.id === id ? { ...i, status } : i)) });
    } catch (e) {
      setErr(`Статус не сохранился (${(e as Error).message}) – попробуйте ещё раз.`);
    } finally { setBusy(''); }
  };

  if (!d) return <div class="w"><h1>Рекомендации</h1><p class="m">{err || 'Загружаю…'}</p></div>;
  const items = [...d.items].sort((a, b) => ORDER.indexOf(a.prioritet) - ORDER.indexOf(b.prioritet));
  const open = (p: string) => d.items.filter((i) => i.prioritet === p && i.status !== 'sdelano' && i.status !== 'ne_nado').length;
  return (
    <div class="w">
      <h1>Что улучшить на {d.sayt}</h1>
      <p class="m">Прогон {d.data}. Агент улучшений собрал находки проверок сайта и данных и отсортировал по важности. Статусы ставите вы – агент их помнит.</p>
      {err && <p class="m" role="alert" style="color:var(--sr)">{err}</p>}
      <div class="sum">
        <div><b>{open('srochno')}</b>срочно</div><div><b>{open('vazhno')}</b>важно</div><div><b>{open('mozhno')}</b>можно</div>
        <div><b>{d.items.filter((i) => i.status === 'sdelano').length}</b>сделано</div>
      </div>
      {items.map((i) => (
        <article class={`it ${i.prioritet} st-${i.status}`} key={i.id}>
          <header><span class="pr">{PR[i.prioritet]}</span><span class="st">{ST[i.status] || i.status}</span> <span class="us">усилие {i.usilie}</span><span class="ob">{i.oblast}</span></header>
          <h3>{i.zagolovok}</h3>
          <p><b>Что не так:</b> {i.chto}</p><p><b>Почему важно:</b> {i.pochemu_vazhno}</p><p><b>Как исправить:</b> {i.kak_ispravit}</p>
          <details><summary>Доказательство и кто нашёл</summary><p>{i.dokazatelstvo}</p><p class="m">Нашёл: {i.kto} · впервые {i.vpervye} · {i.istochnik}</p></details>
          <footer>
            {BTN.map(([s, label]) => (
              <button type="button" disabled={busy === i.id} aria-pressed={i.status === s} class={i.status === s ? 'on' : ''}
                onClick={() => mark(i.id, i.status === s ? 'novoe' : s)}>{label}</button>
            ))}
          </footer>
        </article>
      ))}
    </div>
  );
}
