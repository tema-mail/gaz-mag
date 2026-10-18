import { useState } from 'preact/hooks';

// Окно «Импорт CSV» по образцу Тильды (Магазин → Импорт). Демо: файл читается только чтобы показать,
// сколько строк в нём найдено; в каталог ничего не загружается.

// Колонки – формат выгрузки магазина Тильды, чтобы можно было перенести товары оттуда как есть.
export const CSV_COLUMNS = [
  ['SKU', 'Артикул', 'GM-0001'],
  ['Category', 'Каталоги через «;»', 'Котлы газового оборудования;Специальные предложения'],
  ['Title', 'Название', 'Настенный газовый котел HUBERT Smart AGB 10-24DY'],
  ['Description', 'Краткое описание', 'Новинка'],
  ['Text', 'Полное описание', 'Двухконтурный, закрытая камера сгорания'],
  ['Photo', 'Ссылки на фото через пробел', 'https://…/1.jpg https://…/2.jpg'],
  ['Price', 'Цена', '44910'],
  ['Price Old', 'Старая цена', ''],
  ['Brand', 'Торговая марка', 'HUBERT'],
  ['Mark', 'Метка', 'Хит'],
  ['Url', 'Адрес страницы (для обновления)', ''],
];

// Шаблон собирается в браузере – открытых файлов в кабинете нет (правило владельца 16.10.2026).
const template = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\ufeff' + CSV_COLUMNS.map((c) => c[0]).join(';') + '\r\n' + CSV_COLUMNS.map((c) => `"${c[2]}"`).join(';'));

export default function CsvImport({ base, onClose }: { base: string; onClose: () => void }) {
  const [file, setFile] = useState<{ name: string; rows: number } | null>(null);
  const [opts, setOpts] = useState({ csv: true, update: true, parts: true, photos: true, hide: false });
  const [done, setDone] = useState(false);

  const pick = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const text = await f.text();
    const rows = text.split(/\r?\n/).filter((l) => l.trim()).length - 1;
    setFile({ name: f.name, rows: Math.max(0, rows) });
  };
  const opt = (k: keyof typeof opts, label: string, hint?: string) => (
    <label class="ck ck--block">
      <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: (e.target as HTMLInputElement).checked })} />
      <span>{label}{hint && <small>{hint}</small>}</span>
    </label>
  );

  return (
    <div class="ed" role="dialog" aria-modal="true" aria-label="Импорт товаров из CSV">
      <div class="ed__bg" onClick={onClose} />
      <div class="ed__panel ed__panel--narrow">
        <header class="ed__head">
          <div><p class="muted" style="margin:0;font-size:12px">Магазин → импорт</p><h2>Загрузка товаров из CSV</h2></div>
          <button class="btn" onClick={onClose}>Закрыть</button>
        </header>
        <div class="ed__body">
          <ol class="steps">
            <li>
              <b>Файл</b>
              <label class={`drop${file ? ' drop--ok' : ''}`}>
                <input type="file" accept=".csv,text/csv" hidden onChange={pick} />
                {file ? <><b>{file.name}</b><span>Найдено строк с товарами: {file.rows}</span></> : <><b>Выберите CSV-файл</b><span>или перетащите его сюда · кодировка UTF-8, разделитель «;»</span></>}
              </label>
              <p class="muted" style="margin:8px 0 0;font-size:12.5px">
                <a href={template} download="gaz-mag-template.csv">Скачать шаблон</a> · выгрузить текущие товары – кнопка «Экспорт CSV» в списке; их можно поправить в Excel и загрузить обратно.
              </p>
            </li>
            <li>
              <b>Как загружать</b>
              {opt('csv', 'Загрузка через CSV', 'Товары берутся из файла, а не вводятся вручную')}
              {opt('update', 'Обновлять товары с тем же артикулом', 'Цена, фото и описание заменятся; новые артикулы добавятся')}
              {opt('parts', 'Создавать разделы из колонки Category', 'Если раздела ещё нет в каталоге')}
              {opt('photos', 'Скачать фото по ссылкам из колонки Photo')}
              {opt('hide', 'Скрыть товары, которых нет в файле', 'Удобно, когда файл – полный актуальный каталог')}
            </li>
            <li>
              <b>Колонки файла</b>
              <table class="vt vt--cols">
                <thead><tr><th>Колонка</th><th>Что в ней</th><th>Пример</th></tr></thead>
                <tbody>{CSV_COLUMNS.map(([c, d, ex]) => <tr><td><code>{c}</code></td><td>{d}</td><td class="muted">{ex}</td></tr>)}</tbody>
              </table>
            </li>
          </ol>
          {done && <p class="demo-note">Это демо: загрузку подключим, когда решим, где хранить товары (файл в репозитории или база админки).</p>}
        </div>
        <footer class="ed__foot">
          <span class="muted" style="font-size:12.5px">{file ? `Будет обработано: ${file.rows}` : 'Файл не выбран'}</span>
          <button class="btn primary" disabled={!file} onClick={() => setDone(true)}>Загрузить товары</button>
        </footer>
      </div>
    </div>
  );
}
