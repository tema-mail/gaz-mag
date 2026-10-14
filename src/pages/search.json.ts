// Индекс поиска для шторки «Поиск по каталогу»: название, марка и характеристики каждого товара.
import { products } from '../lib/catalog';
export function GET() {
  const hits = products.map((p) => ({
    id: p.id, t: p.title, d: [p.brand, ...p.chars.map((c) => c.v), ...p.options.flatMap((o) => o.values)].join(' '),
    p: p.price, i: p.images[0] ?? '', u: p.path,
  }));
  return new Response(JSON.stringify(hits), { headers: { 'Content-Type': 'application/json' } });
}
