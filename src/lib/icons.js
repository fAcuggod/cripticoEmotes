// Clean SVG icons matching Críptico's editorial icon weight.

export const ICONS = {
  brand: `<svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect x="1.5" y="1.5" width="25" height="25" rx="6" fill="#111612" stroke="#53FC18" stroke-width="2"/>
    <path d="M9.7 11.1c0-2.6 2-4.4 4.7-4.4 2.5 0 4.3 1.6 4.3 3.9 0 1.9-1 3-2.6 3.9-1 .6-1.3 1-1.3 2v.8h-2.6v-1c0-1.8.7-2.8 2.2-3.7 1.1-.6 1.6-1.1 1.6-1.9 0-1-.7-1.7-1.8-1.7-1.2 0-1.9.8-2 2.1H9.7z" fill="#fff"/>
    <circle cx="13.5" cy="20.4" r="1.8" fill="#53FC18"/>
  </svg>`,

  criptico: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.2 9a3.1 3.1 0 0 1 5.9 1.1c0 2-3.1 2.5-3.1 4.4"/>
    <circle cx="12" cy="18.2" r="1.1" fill="currentColor" stroke="none"/>
    <path d="M4.5 7.5L6.5 9.5M19.5 7.5l-2 2"/>
  </svg>`,

  flame: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.7 2.2c.4 2.8-1.4 4.8-2.8 6.4-1.3 1.5-2.4 2.9-2.4 5 0 2.5 2 4.6 4.5 4.6s4.5-2.1 4.5-4.6c0-1.4-.5-2.7-1.3-3.8-.3 1.1-1.1 1.9-2 2 .8-2.3.7-5.6-.5-9.6zM12 22c-4.4 0-7.8-3.4-7.8-7.8 0-3.2 1.8-5.5 3.6-7.6 1.5-1.7 3-3.5 3.1-5.6a.8.8 0 0 1 1.4-.5c2.2 2.5 3.3 5.5 3.1 8.2.4-.4.8-.9 1-1.4a.8.8 0 0 1 1.4-.2c1.4 1.9 2 4.1 2 7.1 0 4.4-3.4 7.8-7.8 7.8z"/>
  </svg>`,

  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="4" width="18" height="17" rx="2"/>
    <path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>`,

  stats: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 20V12M10 20V6M16 20v-9M22 20H2"/>
  </svg>`,

  bookOpen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H10a2 2 0 0 1 2 2v14.5a1.5 1.5 0 0 0-1.5-1.5H4.5A2.5 2.5 0 0 0 2 20.5V5.5z"/>
    <path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H14a2 2 0 0 0-2 2v14.5a1.5 1.5 0 0 1 1.5-1.5h6A2.5 2.5 0 0 1 22 20.5V5.5z"/>
  </svg>`,

  signpost: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3v3M12 13v8M5 6h12l3 3.5L17 13H5V6z"/>
  </svg>`,

  cube: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5z"/>
    <path d="M12 12 20.5 7M12 12v9.5M12 12 3.5 7"/>
  </svg>`,

  letter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3.5 18 8 6l4.5 12M5 14h6"/>
    <path d="M15 13.5a2.5 2.5 0 1 1 5 0V18m0-2.5c-1-.6-4.5-.6-4.5 1.5 0 1.4 1.5 2 3 1.2"/>
  </svg>`,

  number: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>
  </svg>`,

  backspace: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 5H9.5L3 12l6.5 7H21a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/>
    <path d="M12.5 9.5 17.5 14.5M17.5 9.5l-5 5"/>
  </svg>`,

  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9.5"/>
    <path d="M9.6 9.3a2.6 2.6 0 0 1 4.9.9c0 1.7-2.5 2.1-2.5 3.7"/>
    <circle cx="12" cy="17.2" r="1" fill="currentColor" stroke="none"/>
  </svg>`,

  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
    <path d="M6 6l12 12M18 6 6 18"/>
  </svg>`,

  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="9" width="11" height="11" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>`,

  external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 4h6v6M10 14 20 4M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>
  </svg>`,

  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v5l3.2 2"/>
  </svg>`,

  spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3l2.2 6.2L20.5 11l-6.3 1.8L12 19l-2.2-6.2L3.5 11l6.3-1.8L12 3z"/>
  </svg>`,
};
