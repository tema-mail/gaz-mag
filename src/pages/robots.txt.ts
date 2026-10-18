// robots.txt: на боевом домене сайт открыт, служебные страницы закрыты (как в robots оригинала на Тильде).
// На показной копии (PUBLIC_NOINDEX=1) закрыто всё.
export function GET() {
  const site = (import.meta.env.SITE || 'https://gaz-mag.ru').replace(/\/$/, '');
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const body = import.meta.env.PUBLIC_NOINDEX === '1'
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nDisallow: /souz\nDisallow: /thanks\nDisallow: /fail\nDisallow: /api/\nDisallow: /admin\n\nSitemap: ${site}${base}/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
