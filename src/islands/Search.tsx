import { useEffect, useMemo, useState } from 'preact/hooks';
import { fmt, sheet } from '../lib/store';
import { u } from '../lib/url';
import Drawer from './Drawer';
import { IconSearch } from './icons';

// Поиск по каталогу. Индекс (/search.json) грузится при первом открытии.
interface Hit { id: string; t: string; d: string; p: number; i: string; u: string }

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
const QUICK = ['Розы', 'Гортензия', 'Корзина', 'Пионы', 'Хризантема', 'Шары', 'Открытка'];

export default function Search() {
  const open = sheet.value === 'search';
  const [index, setIndex] = useState<Hit[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open || index) return;
    fetch(u('/search.json')).then((r) => r.json()).then(setIndex).catch(() => setIndex([]));
  }, [open]);

  const hits = useMemo(() => {
    const s = norm(q.trim());
    if (!index || s.length < 2) return [];
    const words = s.split(/\s+/);
    return index.filter((h) => { const hay = norm(h.t + ' ' + h.d); return words.every((w) => hay.includes(w)); }).slice(0, 40);
  }, [q, index]);

  return (
    <Drawer open={open} onClose={() => (sheet.value = null)} side="top" label="Поиск по каталогу" title="Поиск по каталогу">
      <form class="srch" onSubmit={(e) => e.preventDefault()} role="search">
        <IconSearch />
        <input
          class="srch__input" type="search" placeholder="Название букета или цветок" value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Что ищем"
        />
      </form>
      {q.trim().length < 2 ? (
        <div class="srch__quick">
          {QUICK.map((w) => <button type="button" class="chip" onClick={() => setQ(w)}>{w}</button>)}
        </div>
      ) : !index ? (
        <p class="srch__note">Загружаем каталог…</p>
      ) : hits.length === 0 ? (
        <p class="srch__note">Ничего не нашли. Напишите нам – флорист соберёт букет под ваш запрос. <button type="button" class="link" data-lead>Оставить заявку</button></p>
      ) : (
        <>
          <p class="srch__note">Найдено: {hits.length}{hits.length === 40 ? '+' : ''}</p>
          <ul class="srch__grid">
            {hits.map((h) => (
              <li>
                <a href={u(h.u)} class="srch__item">
                  <img src={u(h.i + '-480.webp')} alt="" loading="lazy" />
                  <span class="srch__title">{h.t}</span>
                  <span class="srch__price">{fmt(h.p)}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </Drawer>
  );
}
