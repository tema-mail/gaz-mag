// Иконки для островов и .astro (через Icon.astro). Линейные, 24×24, цвет – currentColor.
const P = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

export const IconHeart = ({ filled = false, size = 22 }: { filled?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...P} fill={filled ? 'currentColor' : 'none'} aria-hidden="true">
    <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.2 3.4 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.6 0 5.5 3.7 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
  </svg>
);
export const IconBag = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...P} aria-hidden="true">
    <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </svg>
);
export const IconSearch = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...P} aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
);
export const IconClose = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconChevron = ({ back = false, size = 18 }: { back?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...P} aria-hidden="true"><path d={back ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} /></svg>
);
export const IconArrow = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M7 17L17 7M8 7h9v9" /></svg>
);
export const IconPhone = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...P} aria-hidden="true">
    <path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4z" />
  </svg>
);
export const IconMinus = () => (<svg width="16" height="16" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M5 12h14" /></svg>);
export const IconPlus = () => (<svg width="16" height="16" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>);
export const IconTrash = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6.5 7l1 12.5h9l1-12.5" /></svg>
);
/** Цветок-иконка на кнопках «Выбрать букет» – как на оригинале. */
export const IconFlower = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <g style={{ fill: 'var(--flower, #fecbde)' }}><circle cx="12" cy="6.5" r="4.5" /><circle cx="17.2" cy="10.3" r="4.5" /><circle cx="15.2" cy="16.5" r="4.5" /><circle cx="8.8" cy="16.5" r="4.5" /><circle cx="6.8" cy="10.3" r="4.5" /></g>
    <circle cx="12" cy="12" r="2.6" fill="#fff" />
  </svg>
);

export const Social = ({ id, size = 18 }: { id: string; size?: number }) => {
  if (id === 'wa') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5zm5.5 13.4c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.2 1.1z" /></svg>
  );
  if (id === 'vk') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.8 17.5C6.9 17.5 3.5 13.4 3.4 6.6h3c.1 5 2.3 7.1 4 7.5V6.6h2.8v4.3c1.7-.2 3.5-2.2 4.1-4.3h2.8a8.3 8.3 0 0 1-3.8 5.4 8.6 8.6 0 0 1 4.4 5.5h-3.1a5.4 5.4 0 0 0-4.4-3.9v3.9h-.4z" /></svg>
  );
  if (id === 'tg') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.7 4.3 2.9 11.2c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4 1.7 5.4c.2.6.4.8.8.8.4 0 .6-.2.9-.4l2.2-2.2 4.6 3.4c.8.5 1.5.2 1.7-.8l3-14.2c.3-1.3-.5-1.9-1.5-1.8zM9.4 14.1l8.5-7.7-6.6 8.6-.3 3-1.6-3.9z" /></svg>
  );
  // MAX – облачко сообщения
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a8.5 8.5 0 0 0-7.5 12.6L3.3 20a.6.6 0 0 0 .7.7l4.4-1.2A8.5 8.5 0 1 0 12 3zm0 4.2a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6z" /></svg>
  );
};
