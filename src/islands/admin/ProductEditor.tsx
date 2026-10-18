import { useEffect, useState } from 'preact/hooks';
import type { Edition } from '../../lib/catalog';

// Редактор товара – перенос с кабинета-стандарта Milovini (эталон Elite Rose, «Магазин → товар» Тильды):
// вкладки «Основное», «Фото», «Разделы», «SEO». Отличие по данным gaz-mag: у товаров есть варианты (мощность, объём)
// со своими ценами и характеристики – для них вкладки «Варианты» (создать по параметру, добавить, убрать, цены) и
// «Характеристики»; «Размеры и вес» нет – нет данных.

export interface AdmProduct {
  id: string; title: string; brand: string; sku: string; price: number | null; priceOld: number | null; mark: string;
  descr: string; text: string; images: string[]; lists: string[]; path: string; visible: boolean;
  seoTitle: string; seoDescr: string;
  options: { title: string; values: string[] }[]; editions: Edition[]; chars: { t: string; v: string }[];
}
export interface AdmList { id: string; title: string }

type TabName = 'Основное' | 'Фото' | 'Разделы' | 'Варианты' | 'Характеристики' | 'SEO';

export default function ProductEditor({ product, lists, base, onClose, onSave, onDelete }: {
  product: AdmProduct; lists: AdmList[]; base: string; onClose: () => void; onSave: (p: AdmProduct, files: File[]) => void; onDelete: (p: AdmProduct) => void;
}) {
  const [p, setP] = useState<AdmProduct>(product);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [tab, setTab] = useState<TabName>('Основное');
  const isNew = !product.id;
  const TABS: TabName[] = ['Основное', 'Фото', 'Разделы', 'Варианты', 'Характеристики', 'SEO'];
  const [optName, setOptName] = useState('');
  const [optValues, setOptValues] = useState('');
  const [addValue, setAddValue] = useState('');
  const uid = (i = 0) => String(Date.now() + i);
  /** Создать варианты по одному параметру: «Мощность, кВт» + «10кВт, 13кВт» → по варианту на значение, цена – цена товара. */
  const makeVariants = () => {
    const title = optName.trim();
    const values = [...new Set(optValues.split(',').map((v) => v.trim()).filter(Boolean))];
    if (!title || values.length < 2) return;
    setP({ ...p, options: [{ title, values }], editions: values.map((v, i) => ({ id: uid(i), price: p.price, priceOld: p.priceOld, opts: { [title]: v } })) });
  };
  const opt = p.options[0];
  const addVariant = () => {
    const v = addValue.trim();
    if (!opt || !v || opt.values.includes(v)) return;
    setP({ ...p, options: [{ ...opt, values: [...opt.values, v] }], editions: [...p.editions, { id: uid(), price: p.price, priceOld: null, opts: { [opt.title]: v } }] });
    setAddValue('');
  };
  const removeVariant = (i: number) => {
    if (!opt) return;
    const gone = p.editions[i].opts[opt.title];
    const editions = p.editions.filter((_, n) => n !== i);
    // остался один вариант – это уже товар без вариантов
    setP(editions.length < 2 ? { ...p, options: [], editions: [], price: editions[0]?.price ?? p.price } : { ...p, options: [{ ...opt, values: opt.values.filter((v) => v !== gone) }], editions });
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const set = (k: keyof AdmProduct) => (e: Event) => setP({ ...p, [k]: (e.target as HTMLInputElement).value });
  const num = (k: 'price' | 'priceOld') => (e: Event) => { const v = (e.target as HTMLInputElement).value.replace(/\D/g, ''); setP({ ...p, [k]: v ? Number(v) : null }); };
  const edNum = (i: number, k: 'price' | 'priceOld') => (e: Event) => {
    const v = (e.target as HTMLInputElement).value.replace(/\D/g, '');
    setP({ ...p, editions: p.editions.map((ed, n) => (n === i ? { ...ed, [k]: v ? Number(v) : null } : ed)) });
  };
  const setChar = (i: number, k: 't' | 'v') => (e: Event) => setP({ ...p, chars: p.chars.map((c, n) => (n === i ? { ...c, [k]: (e.target as HTMLInputElement).value } : c)) });
  const slug = p.path.split('/').pop() || '';
  const host = (typeof location !== 'undefined' ? location.host : 'gaz-mag.ru');

  return (
    <div class="ed" role="dialog" aria-modal="true" aria-label={isNew ? 'Новый товар' : `Товар «${p.title}»`}>
      <div class="ed__bg" onClick={onClose} />
      <div class="ed__panel">
        <header class="ed__head">
          <div>
            <p class="muted" style="margin:0;font-size:12px">{isNew ? 'Магазин → новый товар' : `Магазин → товар № ${p.id}`}</p>
            <h2>{p.title || 'Новый товар'}</h2>
          </div>
          <label class="sw" title="Показывать на сайте">
            <input type="checkbox" checked={p.visible} onChange={(e) => setP({ ...p, visible: (e.target as HTMLInputElement).checked })} />
            <span />{p.visible ? 'Опубликован' : 'Скрыт'}
          </label>
          <button class="btn" onClick={onClose}>Закрыть</button>
          <button class="btn primary" onClick={() => onSave(p, files.map((f) => f.file))}>Сохранить</button>
        </header>
        <nav class="ed__tabs">{TABS.map((t) => <button class={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>

        <div class="ed__body">
          {tab === 'Основное' && (
            <div class="fgrid">
              <label class="f f--wide"><span>Название товара</span><input value={p.title} onInput={set('title')} placeholder="Например, Настенный газовый котел HUBERT Smart AGB 10-24DY" /></label>
              <label class="f"><span>Цена, ₽ {p.editions.length > 1 && <em>у вариантов – свои цены</em>}</span><input inputMode="numeric" value={p.price ?? ''} onInput={num('price')} /></label>
              <label class="f"><span>Старая цена, ₽</span><input inputMode="numeric" value={p.priceOld ?? ''} onInput={num('priceOld')} placeholder="Для скидки" /></label>
              <label class="f"><span>Торговая марка <em>фильтр «Торговая марка»</em></span><input value={p.brand} onInput={set('brand')} placeholder="HUBERT" /></label>
              <label class="f"><span>Артикул</span><input value={p.sku} onInput={set('sku')} placeholder="GM-0001" /></label>
              <label class="f"><span>Метка на карточке</span><input value={p.mark} onInput={set('mark')} placeholder="Хит, Новинка, -10%" /></label>
              <label class="f f--wide"><span>Краткое описание <em>под названием в каталоге</em></span><input value={p.descr} onInput={set('descr')} placeholder="Например, Новинка" /></label>
              <label class="f f--wide"><span>Полное описание <em>на странице товара</em></span><textarea rows={6} value={p.text} onInput={set('text')} /></label>
            </div>
          )}

          {tab === 'Фото' && (
            <div>
              <p class="muted" style="margin:0 0 12px">Первое фото – обложка в каталоге. Фото товара лучше на белом фоне, от 1000 px.</p>
              <div class="gal">
                {p.images.map((im, i) => (
                  <figure class="gal__item">
                    <img src={`${base}${im}-480.webp`} alt="" />
                    {i === 0 && <span class="gal__cover">Обложка</span>}
                    <button class="gal__del" title="Убрать фото" onClick={() => setP({ ...p, images: p.images.filter((_, n) => n !== i) })}>×</button>
                  </figure>
                ))}
                {files.map((f, i) => (
                  <figure class="gal__item gal__item--new">
                    <img src={f.url} alt="" />
                    {p.images.length === 0 && i === 0 && <span class="gal__cover">Обложка</span>}
                    <span class="gal__badge">загрузится при сохранении</span>
                    <button class="gal__del" title="Убрать фото" onClick={() => setFiles(files.filter((_, n) => n !== i))}>×</button>
                  </figure>
                ))}
                <label class="gal__add">
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { const fl = [...((e.target as HTMLInputElement).files || [])]; setFiles([...files, ...fl.map((file) => ({ file, url: URL.createObjectURL(file) }))]); (e.target as HTMLInputElement).value = ''; }} />
                  <b>+</b><span>Загрузить фото</span><small>или перетащите сюда</small>
                </label>
              </div>
            </div>
          )}

          {tab === 'Разделы' && (
            <div>
              <p class="muted" style="margin:0 0 12px">Товар может быть в нескольких разделах – на сайте он покажется в каждом. «Специальные предложения» – лента на главной и в «Акциях», «HUBERT» – каталог на странице котлов HUBERT.</p>
              <div class="checks">
                {lists.map((l) => (
                  <label class="ck"><input type="checkbox" checked={p.lists.includes(l.id)} onChange={(e) => setP({ ...p, lists: (e.target as HTMLInputElement).checked ? [...p.lists, l.id] : p.lists.filter((x) => x !== l.id) })} />{l.title}</label>
                ))}
              </div>
            </div>
          )}

          {tab === 'Варианты' && p.editions.length < 2 && (
            <div class="fgrid">
              <p class="muted f--wide" style="margin:0">У товара нет вариантов. Задайте параметр и значения – получится по варианту на каждое значение (например, мощность котла или объём бака), цены потом поправьте в таблице.</p>
              <label class="f"><span>Параметр</span><input value={optName} onInput={(e) => setOptName((e.target as HTMLInputElement).value)} placeholder="Мощность, кВт" /></label>
              <label class="f"><span>Значения через запятую</span><input value={optValues} onInput={(e) => setOptValues((e.target as HTMLInputElement).value)} placeholder="10кВт, 13кВт, 18кВт, 24кВт" /></label>
              <div class="f--wide"><button class="btn primary" type="button" onClick={makeVariants} disabled={!optName.trim() || optValues.split(',').filter((v) => v.trim()).length < 2}>Создать варианты</button></div>
            </div>
          )}
          {tab === 'Варианты' && p.editions.length >= 2 && (
            <div>
              <p class="muted" style="margin:0 0 12px">Покупатель выбирает вариант на странице товара; в корзину попадает цена варианта. В каталоге показывается самая низкая цена с «от». Слово «Мощность» в названии параметра включает фильтр «Мощность» в каталоге.</p>
              <table class="vt">
                <thead><tr>{p.options.map((o) => <th>{o.title}</th>)}<th>Цена, ₽</th><th>Старая цена, ₽</th><th></th></tr></thead>
                <tbody>
                  {p.editions.map((ed, i) => (
                    <tr>
                      {p.options.map((o) => <td>{ed.opts[o.title]}</td>)}
                      <td><input inputMode="numeric" value={ed.price ?? ''} onInput={edNum(i, 'price')} aria-label="Цена варианта" /></td>
                      <td><input inputMode="numeric" value={ed.priceOld ?? ''} onInput={edNum(i, 'priceOld')} aria-label="Старая цена варианта" /></td>
                      <td><button class="btn ghost" type="button" title="Убрать вариант" onClick={() => removeVariant(i)}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {opt && (
                <div style="display:flex;gap:8px;margin-top:10px;align-items:center">
                  <input value={addValue} onInput={(e) => setAddValue((e.target as HTMLInputElement).value)} placeholder={`Новое значение «${opt.title}»`} aria-label="Новое значение" style="max-width:260px" />
                  <button class="btn" type="button" onClick={addVariant} disabled={!addValue.trim()}>+ Добавить вариант</button>
                </div>
              )}
            </div>
          )}

          {tab === 'Характеристики' && (
            <div>
              <p class="muted" style="margin:0 0 12px">Таблица «Характеристики» на странице товара. Названия «Камера сгорания», «Количество контуров», «Отапливаемая площадь, м2», «Тип дымохода» работают ещё и как фильтры каталога – пишите их так же.</p>
              <table class="vt">
                <thead><tr><th>Характеристика</th><th>Значение</th><th></th></tr></thead>
                <tbody>
                  {p.chars.map((c, i) => (
                    <tr>
                      <td><input value={c.t} onInput={setChar(i, 't')} aria-label="Название характеристики" /></td>
                      <td><input value={c.v} onInput={setChar(i, 'v')} aria-label="Значение" /></td>
                      <td><button class="btn ghost" title="Убрать" onClick={() => setP({ ...p, chars: p.chars.filter((_, n) => n !== i) })}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button class="btn" style="margin-top:10px" onClick={() => setP({ ...p, chars: [...p.chars, { t: '', v: '' }] })}>+ Добавить характеристику</button>
            </div>
          )}

          {tab === 'SEO' && (
            <div class="fgrid">
              <label class="f f--wide"><span>Адрес страницы <em>создаётся из названия, менять не нужно</em></span><div class="url"><em>{p.path ? p.path.replace(/[^/]+$/, '') : '/<каталог>/tproduct/'}</em><input value={slug} placeholder="из названия" readOnly /></div></label>
              <label class="f f--wide"><span>Title <em>{(p.seoTitle || '').length}/70 · пусто – «название – купить в Новосибирске, цена»</em></span><input value={p.seoTitle} onInput={set('seoTitle')} /></label>
              <label class="f f--wide"><span>Description <em>{(p.seoDescr || '').length}/160</em></span><textarea rows={3} value={p.seoDescr} onInput={set('seoDescr')} /></label>
              <div class="snip f--wide">
                <span class="snip__url">{host} › {p.path.split('/')[1] || 'catalog'} › {slug}</span>
                <span class="snip__t">{p.seoTitle || `${p.title} – купить в Новосибирске`}</span>
                <span class="snip__d">{p.seoDescr || 'Описание для поиска появится здесь.'}</span>
              </div>
            </div>
          )}
        </div>
        {!isNew && <footer class="ed__foot"><button class="btn ghost" style="color:#b0333f" onClick={() => onDelete(p)}>Удалить товар</button><a class="btn" href={`${base}${p.path}`} target="_blank">Открыть на сайте ↗</a></footer>}
      </div>
    </div>
  );
}
