// Фото, загруженные через админку (data-src/uploads/<имя>.<jpg|png|webp>), → public/img/up/<имя>-480.webp и -1000.webp.
// Запускается перед сборкой (npm run build), в т. ч. в GitHub Actions. Уже готовые файлы не пересобираются.
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'data-src/uploads');
const OUT = path.join(ROOT, 'public/img/up');
await mkdir(OUT, { recursive: true });
const files = existsSync(SRC) ? (await readdir(SRC)).filter((f) => /\.(jpe?g|png|webp|heic|avif)$/i.test(f)) : [];
let made = 0;
for (const f of files) {
  const name = f.replace(/\.[^.]+$/, '');
  for (const w of [480, 1000]) {
    const out = path.join(OUT, `${name}-${w}.webp`);
    if (existsSync(out)) continue;
    await sharp(path.join(SRC, f)).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
    made++;
  }
}
console.log(`фото из админки: ${files.length}, новых webp: ${made}`);
