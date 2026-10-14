// Контакты и навигация – одно место для шапки, меню, подвала и страниц.
export const SITE = {
  name: 'Milovini Flowers',
  city: 'Самара',
  address: 'ул. Первомайская, 26',
  phone: '+7 (937) 171-11-77',
  phoneHref: 'tel:+79371711177',
  hours: 'Круглосуточно',
  owner: 'ИП Нелипенко Николай Дмитриевич',
  inn: '635007922915',
  yandexOrg: 'https://yandex.ru/maps/org/19061492696/',
  yandexReviews: 'https://yandex.ru/maps/org/19061492696/reviews/',
};

export const SOCIALS = [
  { id: 'wa', label: 'WhatsApp', href: 'https://wa.me/79371711177' },
  { id: 'vk', label: 'ВКонтакте', href: 'https://vk.com/milovini_samara' },
  { id: 'max', label: 'MAX', href: 'https://max.ru/u/f9LHodD0cOJVoLWt5U-wY4KrOi-LInMxkMIpKx2TMrNrl9NpfRqyWCclW5E' },
  { id: 'tg', label: 'Telegram', href: 'https://t.me/milovini_samara' },
] as const;

/** Верхнее меню – как на оригинале. */
export const NAV = [
  { label: 'Главная', href: '/' },
  { label: 'Акции', href: '/akcii' },
  { label: 'Корпоративным клиентам', href: '/corparate' },
  { label: 'Доставка 24/7', href: '/delivery' },
  { label: 'Каталог цветов', href: '/catalog' },
  { label: 'Авторские букеты', href: '/catalog/author_bouquets' },
  { label: 'Отзывы', href: '/#rev' },
  { label: 'Преимущества', href: '/#preim' },
  { label: 'Гарантии', href: '/garantee' },
  { label: 'Контакты', href: '/contact' },
];

/** Страницы-каталоги: адрес оригинала → раздел магазина Тильды (uid), тексты и фото первого экрана – с оригинала. */
const TC = 'https://static.tildacdn.com/';
const tail = 'и оформите доставку по Самаре. Перед отправкой пришлём фото готового заказа на согласование.';
export const CATALOGS = [
  { slug: 'byket', title: 'Букеты', crumb: 'Букеты', h1: 'Букеты с доставкой в Самаре', heading: 'Каталог букетов', part: '341115852183', text: 'Выберите готовый букет Milovini ' + tail, image: TC + 'tild3033-6530-4364-b338-373362386238/_2026-08-27_12111906.png' },
  { slug: 'compositions', title: 'Композиции', crumb: 'Композиции', h1: 'Композиции с доставкой в Самаре', heading: 'Каталог композиций', part: '955321941123', text: 'Выберите готовую композицию Milovini ' + tail, image: TC + 'tild3765-3432-4530-b664-336134623934/_2026-08-27_12102997.png' },
  { slug: 'author_bouquets', title: 'Авторские букеты', crumb: 'Авторские букеты', h1: 'Авторские букеты с доставкой в Самаре', heading: 'Каталог авторских букетов', part: '740114444853', text: 'Выберите авторские букеты Milovini ' + tail, image: TC + 'tild6137-3531-4965-a466-396266343537/_2026-08-27_12095910.png' },
  { slug: 'monobooks', title: 'Монобукеты', crumb: 'Монобукеты', h1: 'Монобукеты с доставкой в Самаре', heading: 'Каталог монобукетов', part: '904968341543', text: 'Выберите монобукеты Milovini ' + tail, image: TC + 'tild3339-6335-4732-b738-616161663635/_2026-08-27_12084731.png' },
  { slug: 'kenyan_roses', title: 'Кенийские розы', crumb: 'Кенийские розы', h1: 'Кенийские розы с доставкой в Самаре', heading: 'Каталог кенийских роз', part: '284065491443', text: 'Выберите кенийские розы Milovini ' + tail, image: TC + 'tild3130-3030-4538-a666-393137623133/_2026-08-27_12081790.png' },
  { slug: 'ecuadorian_roses', title: 'Эквадорские розы', crumb: 'Эквадорские розы', h1: 'Эквадорские розы с доставкой в Самаре', heading: 'Каталог эквадорских роз', part: '972753228283', text: 'Выберите эквадорские розы Milovini ' + tail, image: TC + 'tild3363-6166-4161-b766-376666376166/_2026-08-27_12073626.png' },
  { slug: 'akcii', title: 'Акции', crumb: 'Акции', h1: 'Акции', heading: 'Каталог акций', part: '265012082143', text: 'Выберите цветы по акции Milovini ' + tail, image: TC + 'tild6135-3063-4365-b063-376536333236/_2026-08-27_12070532.png' },
  { slug: 'baloon', title: 'Шары', crumb: 'Шары', h1: 'Шары', heading: 'Каталог шаров', part: '141481287633', text: 'Выберите шары Milovini ' + tail, image: TC + 'tild3261-3738-4463-b636-336633373466/_2026-08-27_12063281.png' },
  // На оригинале раздел «1 сентября» в магазине удалён – собираем из открыток «Учителю» и шаров «1 сентября».
  { slug: '1_september', title: '1 сентября', crumb: '1 сентября', h1: '1 сентября', heading: 'Каталог 1 сентября', part: '531994305643', match: '1 сентября', text: 'Выберите для 1 сентября Milovini ' + tail, image: TC + 'tild6463-3031-4461-b761-326634333436/image.png' },
];

export const FOOTER = {
  menu: [
    { label: 'Главная', href: '/' },
    { label: 'Акции', href: '/akcii' },
    { label: 'Корпоративным клиентам', href: '/corparate' },
    { label: 'Каталог цветов', href: '/catalog' },
    { label: 'Уникальные букеты', href: '/catalog/author_bouquets' },
    { label: 'Отзывы', href: '/#rev' },
    { label: 'Преимущества', href: '/#preim' },
    { label: 'Гарантии', href: '/garantee' },
    { label: 'Доставка 24/7', href: '/delivery' },
    { label: 'Контакты', href: '/contact' },
  ],
  catalog: CATALOGS.map((c) => ({ label: c.title, href: `/catalog/${c.slug}` })),
  buyers: [
    { label: 'Акции', href: '/akcii' },
    { label: 'Доставка и оплата', href: '/delivery' },
    { label: 'Избранное', href: '/favorites' },
    { label: 'Корзина', href: '/order' },
  ],
  info: [
    { label: 'Политика конфиденциальности', href: '/policy' },
    { label: 'Пользовательское соглашение', href: '/agreement' },
  ],
};

// Плитки преимуществ под первым экраном (иконки – с оригинала).
const T = 'https://static.tildacdn.com/';
export const FEATURE = {
  bonus: { icon: T + 'tild6637-6432-4264-b966-313138663665/Frame_1171275424.svg', text: '5% бонусов с каждого заказа' },
  allday: { icon: T + 'tild6263-3032-4531-b539-666233343765/Frame_1171275425.svg', text: 'Работаем круглосуточно' },
  guarantee: { icon: T + 'tild6664-6636-4230-b730-396330613038/Frame_1171275422.svg', text: 'Гарантия качества 48 часов' },
  delivery: { icon: T + 'tild3265-6538-4530-b265-623136306364/Frame_1171275423.svg', text: 'Доставка по Самаре от 60 минут' },
  photo: { icon: T + 'tild6263-3032-4531-b539-666233343765/Frame_1171275425.svg', text: 'Фото перед доставкой' },
} as const;
export type FeatureKey = keyof typeof FEATURE;

/** Плитки разделов (страницы «О компании» и «Корпоративным клиентам»), картинки – с оригинала. */
export const CATEGORY_TILES = [
  { title: 'Букеты', href: '/catalog/byket', image: T + 'tild3566-6666-4666-a539-663362353439/Frame_689.png' },
  { title: 'Композиции', href: '/catalog/compositions', image: T + 'tild6363-3036-4331-b661-323864316366/Frame_690.png' },
  { title: 'Авторские букеты', href: '/catalog/author_bouquets', image: T + 'tild6565-3838-4835-a634-333531346637/Frame_691.png' },
  { title: 'Монобукеты', href: '/catalog/monobooks', image: T + 'tild3030-6235-4066-b235-353036633135/Frame_692.png' },
  { title: 'Кенийские розы', href: '/catalog/kenyan_roses', image: T + 'tild6536-3639-4337-b864-373038653766/Frame_692.png' },
  { title: 'Эквадорские розы', href: '/catalog/ecuadorian_roses', image: T + 'tild6365-3634-4062-b861-636439343038/Frame_692.png' },
  { title: 'Акции', href: '/catalog/akcii', image: T + 'tild3363-3764-4537-b738-363539623865/Frame_692.png' },
  { title: 'Шары', href: '/catalog/baloon', image: T + 'tild3865-3261-4638-a264-343831356166/Frame_692.png' },
  { title: 'Популярное', href: '/catalog?part=585058774593', image: T + 'tild6238-6131-4538-a537-653466393666/Frame_692.png' },
  { title: '1 сентября', href: '/catalog/1_september', image: T + 'tild6463-3462-4531-b430-666339643361/Frame_692.png' },
];
