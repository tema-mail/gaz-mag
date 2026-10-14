// Сайт может жить в подпапке (GitHub Pages: /gaz-mag). Все внутренние ссылки и картинки – через u().
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

export function u(path: string): string {
  if (!path || /^(https?:|tel:|mailto:|#|data:)/.test(path)) return path;
  if (BASE && path.startsWith(BASE + '/')) return path;
  return BASE + (path.startsWith('/') ? path : '/' + path);
}

/** Картинка товара нужной ширины; у 16 товаров на оригинале нет фото – показываем заглушку. */
export const thumb = (img: string | undefined, w: 480 | 1000 = 480) => (img ? u(`${img}-${w}.webp`) : u('/img/no-photo.svg'));
