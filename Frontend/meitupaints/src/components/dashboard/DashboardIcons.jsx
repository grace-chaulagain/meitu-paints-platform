const paths = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  orders: (
    <>
      <path d="M4 5h16v10l-3 4H7l-3-4V5Z" />
      <path d="M4 15h5l1.5 2h3L15 15h5" />
    </>
  ),
  stock: (
    <>
      <path d="M12 3 4.5 7.25 12 11.5l7.5-4.25L12 3Z" />
      <path d="M4.5 7.5v8.75L12 21l7.5-4.75V7.5" />
      <path d="M12 11.5V21" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  invoice: (
    <>
      <path d="M7 3h7l4 4v14H7V3Z" />
      <path d="M14 3v5h5" />
      <path d="M9.5 12h5" />
      <path d="M9.5 16h5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21h4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </>
  ),
  sort: (
    <>
      <path d="M8 5v14" />
      <path d="m5 8 3-3 3 3" />
      <path d="M16 19V5" />
      <path d="m13 16 3 3 3-3" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.6 2.6L16.5 9" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4V8Z" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v9H3V6Z" />
      <path d="M14 9h4l3 3v3h-7V9Z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  print: (
    <>
      <path d="M7 8V3h10v5" />
      <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7v-7Z" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </>
  ),
  reject: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 8 8 8" />
      <path d="m16 8-8 8" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  logout: (
    <>
      <path d="M10 4H5v16h5" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </>
  ),
  store: (
    <>
      <path d="M4 9 5.5 4h13L20 9" />
      <path d="M4 9v11h16V9" />
      <path d="M4 9h16" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  handshake: (
    <>
      <path d="M3 11l4-4 4 3 3-3 4 4" />
      <path d="M3 11l3 6 4-2 2 2 4-1 4-6" />
      <path d="M10 10l3 4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10" />
      <path d="M11 20V4" />
      <path d="M18 20v-7" />
      <path d="M3 20h18" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.3M12 18.7V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.3M18.7 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 12h4l1.8 3h4.4L16 12h4" />
      <path d="M5.2 5h13.6L21 12v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6L5.2 5Z" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14" />
      <path d="M9 7V4h6v3" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  headset: (
    <>
      <path d="M4 13a8 8 0 0 1 16 0" />
      <rect x="3" y="13" width="4" height="6" rx="1.6" />
      <rect x="17" y="13" width="4" height="6" rx="1.6" />
      <path d="M20 19v1a3 3 0 0 1-3 3h-3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.2 5 6v5.4c0 4.6 3 7.8 7 9.4 4-1.6 7-4.8 7-9.4V6l-7-2.8Z" />
      <path d="m9.3 12 2 2 3.4-4" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8.5" r="4.5" />
      <path d="M9.5 12.2 8 21l4-2.4 4 2.4-1.5-8.8" />
      <path d="m10.2 8.5 1.2 1.2 2.4-2.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  package: (
    <>
      <path d="M21 8l-9-5-9 5 9 5 9-5Z" />
      <path d="M3 8v9l9 5 9-5V8" />
      <path d="M12 13v9" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </>
  ),
  checkmark: <path d="m5 12 5 5L19 7" />,
  checkSquare: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <path d="m8 12 2.6 2.6L16.5 9" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  trend: (
    <>
      <path d="M4 16 10 10 14 14 20 6" />
      <path d="M14 6h6v6" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15.5-6.5L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.5L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  moreHorizontal: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.2 11.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.2" r="3.4" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  // Filled variants for the dealer mobile tab bar's selected-tab state
  // (spec: SF Symbols behavior, outline when idle / .fill when selected).
  // Per-shape fill="currentColor" stroke="none" overrides the shared
  // <svg> wrapper's fill:none/stroke:currentColor, same pattern already
  // used by moreHorizontal above.
  homeFill: (
    <>
      <path d="M4 11.5 12 4l8 7.5v8a1 1 0 0 1-1 1h-4v-6h-4v6H5a1 1 0 0 1-1-1v-8Z" fill="currentColor" stroke="none" />
    </>
  ),
  overviewFill: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  ordersFill: (
    <>
      <path d="M4 5h16v10l-3 4H7l-3-4V5Z" fill="currentColor" stroke="none" />
      <path d="M4 15h5l1.5 2h3L15 15h5v1.2l-2.6 3.5a1 1 0 0 1-.8.4H8.4a1 1 0 0 1-.8-.4L5 16.2V15Z" fill="var(--color-snow,#fff)" stroke="none" opacity="0.001" />
    </>
  ),
  // Arrival-chime mute toggle (order-flow §2.6) - a matched pair so the
  // button's icon itself communicates current state, not just its title.
  volume: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M17 9a4.5 4.5 0 0 1 0 6" />
      <path d="M19.5 6.5a8.5 8.5 0 0 1 0 11" />
    </>
  ),
  volumeMuted: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16.5 10 21 14.5" />
      <path d="M21 10 16.5 14.5" />
    </>
  ),
};

export function DashboardIcon({ name, size = 20, strokeWidth = 1.9, className = "", style }) {
  const path = paths[name] || paths.overview;

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      style={style}
    >
      {path}
    </svg>
  );
}

export default DashboardIcon;
