import map from '../data/images.json';
import { u } from './url';

const M = map as Record<string, string>;

/** Ссылка tildacdn → локальная картинка (скачивает `npm run data -- --img`). Ширина: 800 или 1600. */
export function img(url: string, w: 800 | 1600 = 1600): string {
  const local = M[url];
  if (!local) return url; // ещё не скачана – пусть видно, что берётся с CDN
  return u(/\.(svg|gif)$/.test(local) ? local : `${local}-${w}.webp`);
}

/** srcset для крупных картинок страниц. */
export function srcset(url: string): string | undefined {
  const local = M[url];
  if (!local || /\.(svg|gif)$/.test(local)) return undefined;
  return `${u(local)}-800.webp 800w, ${u(local)}-1600.webp 1600w`;
}
