import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// Адрес сайта для canonical и sitemap. Боевой домен клиента – milovinisamara.ru (пока на Тильде),
// на время показа – GitHub Pages (PUBLIC_SITE_URL задаёт workflow).
const SITE = process.env.PUBLIC_SITE_URL || 'https://milovinisamara.ru';
// Подпапка для GitHub Pages (например /milovini-samara), на своём домене – пусто.
const BASE = process.env.PUBLIC_BASE || '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: [preact()],
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
