// Контакты и навигация – одно место для шапки, меню, подвала и страниц. Всё снято с gaz-mag.ru 14.10.2026.
export const SITE = {
  name: 'Магазин газового оборудования',
  city: 'Болотное',
  address: 'улица Забабонова, 55А, Болотное, Новосибирская область',
  addressShort: 'г. Болотное, ул. Забабонова, 55А',
  phones: [
    { text: '8 (913) 458-45-67', href: 'tel:+79134584567' },
    { text: '8 (952) 941-66-39', href: 'tel:+79529416639' },
  ],
  email: 'Gazmag.bolotnoe@yandex.ru',
  owner: 'ИП Меньшиков Антон Юрьевич',
  inn: '5435 5029 8025',
  ogrnip: '32354 76000 64716',
};

/** Пункт выдачи котлов HUBERT в Новосибирске – со страницы /hubert. */
export const NSK_POINT = {
  address: 'ул. Писарева, 60, офис 1.10, 1 этаж',
  contact: 'Дмитрий',
  phone: { text: '+7 (953) 780-07-20', href: 'tel:+79537800720' },
  hours: 'Пн–Пт: 09:00–18:00, Сб–Вс: выходной',
  route: 'https://yandex.ru/maps/?text=' + encodeURIComponent('Новосибирск, ул. Писарева, 60'),
};

export const SOCIALS = [
  { id: 'tg', label: 'Telegram', href: 'https://t.me/+79134584567' },
  { id: 'wa', label: 'WhatsApp', href: 'https://wa.me/79134584567' },
  { id: 'vk', label: 'ВКонтакте', href: 'https://vk.com/public221944882' },
] as const;

/** Каталоги: адрес оригинала, название, картинка плитки (с главной оригинала). */
const T = 'https://static.tildacdn.com/';
export const CATALOGS = [
  { slug: 'catalog_boilers', title: 'Котлы газового оборудования', short: 'Газовые котлы', image: T + 'tild6134-3736-4638-b830-386263343166/Frame_101.png' },
  { slug: 'catalog_gaz_waterheaters', title: 'Газовые водонагреватели', short: 'Газовые водонагреватели', image: T + 'tild6130-3430-4237-b937-353837386366/Frame_102.png' },
  { slug: 'catalog_el_waterheaters', title: 'Электрические водонагреватели', short: 'Электрические водонагреватели', image: T + 'tild3764-6463-4336-a166-303936656433/image_24-2.png' },
  { slug: 'catalog_indirect_boilers', title: 'Бойлеры косвенного нагрева', short: 'Бойлеры косвенного нагрева', image: T + 'tild3939-3263-4436-b833-306536613163/image_25-2.png' },
  { slug: 'catalog_other', title: 'Радиаторы и иные товары для отопления', short: 'Радиаторы и товары для отопления', image: T + 'tild3635-3863-4037-b132-626266313035/telegram-cloud-docum.png' },
  { slug: 'gas', title: 'Датчики загазованности и модули управления', short: 'Датчики и модули управления', image: T + 'tild3337-3965-4662-a339-363630333635/Group_556.png' },
] as const;
export type CatalogSlug = (typeof CATALOGS)[number]['slug'];

export interface NavItem { label: string; href: string; children?: { label: string; href: string }[] }
export const NAV: NavItem[] = [
  { label: 'Каталог', href: '/catalogcentr', children: CATALOGS.map((c) => ({ label: c.title, href: '/' + c.slug })) },
  { label: 'Hubert', href: '/hubert' },
  { label: 'Акции', href: '/akcii' },
  {
    label: 'Монтаж', href: '/montag', children: [
      { label: 'Подключение к газовым сетям и монтаж отопления', href: '/montag' },
      { label: 'Установка газовых котлов', href: '/ustanovka-kotla' },
    ],
  },
  { label: 'Контакты', href: '#contacts' },
  { label: 'О компании', href: '/about' },
];

export const FOOTER = {
  menu: [
    { label: 'Каталог', href: '/catalogcentr' },
    { label: 'Акции', href: '/akcii' },
    { label: 'Монтаж и подключение газа', href: '/montag' },
    { label: 'Установка котлов', href: '/ustanovka-kotla' },
    { label: 'Котлы Hubert', href: '/hubert' },
    { label: 'О компании', href: '/about' },
    { label: 'Реквизиты', href: '/rekvezit' },
  ],
  catalog: CATALOGS.map((c) => ({ label: c.short, href: '/' + c.slug })),
  legal: [
    { label: 'Политика конфиденциальности', href: '/policy' },
    { label: 'Пользовательское соглашение', href: '/agreement' },
    { label: 'Договор оферты', href: '/oferta' },
  ],
};
