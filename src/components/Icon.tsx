import type { ReactNode } from "react";

export type IconName =
  | "home" | "basket" | "cart" | "box" | "wallet" | "chart" | "clock" | "settings"
  | "plus" | "chevron" | "search" | "bell" | "wifi" | "cloud" | "download" | "print"
  | "edit" | "trash" | "close" | "check" | "arrowUp" | "arrowDown" | "calendar"
  | "coins" | "receipt" | "truck" | "leaf" | "menu" | "logout" | "login" | "shield"
  | "sparkle" | "filter" | "refresh" | "circle" | "user";

const glyphs: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-7h6v7"/></>,
  basket: <><path d="m4 10 2 10h12l2-10H4Z"/><path d="m8 10 4-7 4 7M8 14h.01M12 14h.01M16 14h.01"/></>,
  cart: <><path d="M3 4h2l2.2 11h11.6L21 8H6"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></>,
  box: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9"/></>,
  wallet: <><path d="M4 6.5h15A2 2 0 0 1 21 8.5v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h13"/><path d="M21 12h-5a2 2 0 0 0 0 4h5"/><path d="M16 14h.01"/></>,
  chart: <><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/><path d="M19 7v4h-4"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.2 1-.9 1.6-1.5-.4a8 8 0 0 1-1.3.8l-.3 1.6h-2l-.4-1.5a8 8 0 0 1-1.5 0l-.5 1.5h-2l-.3-1.6a8 8 0 0 1-1.3-.8l-1.5.4-.9-1.6 1.2-1a8 8 0 0 1-.3-1.5l-1.3-.7v-2l1.5-.4a8 8 0 0 1 .7-1.4l-.6-1.4 1.4-1.4 1.5.7a8 8 0 0 1 1.4-.6l.4-1.5h2l.5 1.5a8 8 0 0 1 1.4.6l1.5-.7 1.4 1.4-.6 1.5c.3.4.5.9.6 1.4l1.6.4v2l-1.5.6c0 .6-.1 1-.3 1.5Z"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  chevron: <><path d="m9 18 6-6-6-6"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></>,
  wifi: <><path d="M5 9a11 11 0 0 1 14 0M8 12a6.5 6.5 0 0 1 8 0m-5 3a2 2 0 0 1 2 0"/><circle cx="12" cy="19" r=".7"/></>,
  cloud: <><path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 1 1 0 8H7Z"/><path d="m9 14 2 2 4-4"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/></>,
  print: <><path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z"/><path d="M17 11h.01"/></>,
  edit: <><path d="m14 5 5 5M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/></>,
  trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
  arrowUp: <><path d="M12 19V5m-6 6 6-6 6 6"/></>,
  arrowDown: <><path d="M12 5v14m-6-6 6 6 6-6"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  coins: <><ellipse cx="9" cy="6" rx="6" ry="3"/><path d="M3 6v5c0 1.7 2.7 3 6 3m6-5c3.3 0 6-1.3 6-3m-12 0v5c0 1.7 2.7 3 6 3"/><path d="M15 14c-3.3 0-6 1.3-6 3s2.7 3 6 3 6-1.3 6-3-2.7-3-6-3Zm-6 3v2"/></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h2"/></>,
  truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
  leaf: <><path d="M20 4C10 4 5 7 5 13c0 4 3 7 7 7 6 0 8-6 8-16Z"/><path d="M4 21c3-6 7-9 13-12"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
  login: <><path d="m14 7 5 5-5 5M19 12H5"/><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7"/></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z"/><path d="m19 14 1 2.5 2 .5-2 .8L19 20l-.8-2.2-2.2-.8 2.2-.8L19 14Z"/></>,
  filter: <><path d="M4 6h16M7 12h10m-7 6h4"/></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.7 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.3-3"/></>,
  circle: <><circle cx="12" cy="12" r="8"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
};

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {glyphs[name]}
    </svg>
  );
}
