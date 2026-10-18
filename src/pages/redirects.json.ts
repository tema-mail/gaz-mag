// Карта 301-редиректов «прежний адрес → новый» (ЧПУ, 18.10.2026): страницы (src/lib/routes.ts LEGACY) и тильдовские адреса
// товаров (products.json legacy[]). Скрытый товар – редирект в его раздел. Читает приёмник: /api/go (server/lead.mjs).
import { allProducts } from '../lib/catalog';
import { LEGACY, catalogPath } from '../lib/routes';
export function GET() {
  const map: Record<string, string> = { ...LEGACY };
  for (const p of allProducts) for (const old of p.legacy || []) map[old] = p.hidden ? catalogPath(p.catalog) : p.path;
  return new Response(JSON.stringify(map), { headers: { 'Content-Type': 'application/json' } });
}
