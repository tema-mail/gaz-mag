// sitemap.xml: все страницы сайта, кроме служебных (souz, thanks, fail, 404) – они закрыты noindex.
import { CATALOGS } from '../lib/site';
import { products } from '../lib/catalog';
import { PROMOS } from '../lib/promos';

const PAGES = ['/', '/catalogcentr', '/about', '/montag', '/ustanovka-kotla', '/akcii', '/hubert', '/hubert-dy',
  '/rekvezit', '/policy', '/agreement', '/cookie', '/oferta'];

export function GET() {
  const site = (import.meta.env.SITE || 'https://gaz-mag.ru').replace(/\/$/, '');
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const paths = new Set([
    ...PAGES,
    ...CATALOGS.map((c) => '/' + c.slug),
    ...PROMOS.map((p) => p.href),
    ...products.map((p) => p.path),
  ]);
  const urls = [...paths].map((p) => `  <url><loc>${site}${base}${p === '/' ? '/' : p}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
