import { NSK_POINT, SITE, SOCIALS } from './site';

// Разметка schema.org – одно место для всех страниц (SEO 24.10.2026: раньше Store стоял только на главной).
// Магазин в Болотном, работаем по Новосибирску и Болотному, пункт выдачи HUBERT в Новосибирске.
// Часов работы нет: на сайте их нет, владелец не называл (ТЕХДОЛГ) – не выдумываем.
export const storeLd = (site: string) => ({
  '@context': 'https://schema.org', '@type': 'Store', '@id': `${site}#store`, name: SITE.name, url: site,
  telephone: SITE.phones.map((p) => p.href.replace('tel:', '')), email: SITE.email,
  address: { '@type': 'PostalAddress', streetAddress: 'ул. Забабонова, 55А', addressLocality: 'Болотное', addressRegion: 'Новосибирская область', addressCountry: 'RU' },
  areaServed: [{ '@type': 'City', name: 'Новосибирск' }, { '@type': 'City', name: 'Болотное' }],
  sameAs: SOCIALS.filter((s) => s.id === 'vk').map((s) => s.href),
  department: [{ '@type': 'Store', name: `${SITE.name} – пункт выдачи в Новосибирске`, telephone: NSK_POINT.phone.href.replace('tel:', ''),
    address: { '@type': 'PostalAddress', streetAddress: NSK_POINT.address, addressLocality: 'Новосибирск', addressRegion: 'Новосибирская область', addressCountry: 'RU' } }],
});

/** Услуга магазина: исполнитель – магазин (по @id), район – Новосибирск и Болотное; цена – только та, что видна на странице. */
export const serviceLd = (site: string, path: string, name: string, description: string, priceFrom?: number) => ({
  '@context': 'https://schema.org', '@type': 'Service', name, description, url: new URL(path, site).href,
  provider: { '@id': `${site}#store` }, areaServed: [{ '@type': 'City', name: 'Новосибирск' }, { '@type': 'City', name: 'Болотное' }],
  ...(priceFrom ? { offers: { '@type': 'Offer', priceCurrency: 'RUB', priceSpecification: { '@type': 'PriceSpecification', minPrice: priceFrom, priceCurrency: 'RUB' } } } : {}),
});
