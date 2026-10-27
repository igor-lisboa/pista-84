import type { Lang } from '../i18n/index.ts';

const SMALL_STAR = '<path d="M0-1.4 .4-.4h1.1l-.9.7.3 1.1L0 .7l-.9.7.3-1.1-.9-.7h1.1z"/>';

/**
 * Small inline SVG flags (3:2). Emoji flags are not drawn on Windows, so the
 * language picker ships its own simplified artwork.
 */
const FLAG_BODIES: Readonly<Record<Lang, string>> = {
  'pt-BR': `
    <rect width="30" height="20" fill="#2a9d4a"/>
    <path d="M15 2.5 27 10 15 17.5 3 10z" fill="#ffd93b"/>
    <circle cx="15" cy="10" r="4.6" fill="#2b4ea2"/>
    <path d="M10.6 9.2c3-.8 6.2-.2 8.6 1.4" stroke="#fff" stroke-width="1" fill="none"/>`,
  en: `
    <rect width="30" height="20" fill="#2b3f8f"/>
    <path d="M0 0 30 20M30 0 0 20" stroke="#fff" stroke-width="4"/>
    <path d="M0 0 30 20M30 0 0 20" stroke="#d6253a" stroke-width="1.6"/>
    <path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6.5"/>
    <path d="M15 0v20M0 10h30" stroke="#d6253a" stroke-width="3.6"/>`,
  'pt-PT': `
    <rect width="30" height="20" fill="#d6253a"/>
    <rect width="12" height="20" fill="#1b7a3d"/>
    <circle cx="12" cy="10" r="4.2" fill="#ffd93b"/>
    <circle cx="12" cy="10" r="2.6" fill="#d6253a"/>
    <rect x="10.6" y="8.4" width="2.8" height="3.2" fill="#fff"/>`,
  fr: `
    <rect width="10" height="20" fill="#2b4ea2"/>
    <rect x="10" width="10" height="20" fill="#fff"/>
    <rect x="20" width="10" height="20" fill="#d6253a"/>`,
  it: `
    <rect width="10" height="20" fill="#1b9a4a"/>
    <rect x="10" width="10" height="20" fill="#fff"/>
    <rect x="20" width="10" height="20" fill="#d6253a"/>`,
  ja: `
    <rect width="30" height="20" fill="#fff"/>
    <circle cx="15" cy="10" r="5.6" fill="#d6253a"/>`,
  de: `
    <rect width="30" height="7" fill="#1a1a1a"/>
    <rect y="7" width="30" height="6.5" fill="#d6253a"/>
    <rect y="13.5" width="30" height="6.5" fill="#ffc72c"/>`,
  es: `
    <rect width="30" height="20" fill="#aa151b"/>
    <rect y="5" width="30" height="10" fill="#f1bf00"/>
    <path d="M7 8h5v4l-2.5 2L7 12z" fill="#aa151b"/>
    <path d="M6 7h7v1H6zM6 9h1v4H6zm6 0h1v4h-1z" fill="#fff0bc"/>`,
  hi: `
    <rect width="30" height="20" fill="#fff"/>
    <rect width="30" height="6.67" fill="#ff9933"/>
    <rect y="13.33" width="30" height="6.67" fill="#138808"/>
    <circle cx="15" cy="10" r="2.7" stroke="#000080" stroke-width=".7" fill="none"/>
    <path d="M15 7.3v5.4M12.3 10h5.4m-4.6-1.9 3.8 3.8m0-3.8-3.8 3.8" stroke="#000080" stroke-width=".4"/>`,
  'zh-CN': `
    <rect width="30" height="20" fill="#de2910"/>
    <path d="m6 3 1 2.8h3L7.6 7.6 8.5 10 6 8.5 3.5 10l.9-2.4L2 5.8h3z" fill="#ffde00"/>
    <g fill="#ffde00"><g transform="translate(12 3)">${SMALL_STAR}</g><g transform="translate(14 6)">${SMALL_STAR}</g><g transform="translate(14 9)">${SMALL_STAR}</g><g transform="translate(12 12)">${SMALL_STAR}</g></g>`,
  id: `
    <rect width="30" height="20" fill="#fff"/>
    <rect width="30" height="10" fill="#ce1126"/>`,
  ur: `
    <rect width="30" height="20" fill="#01411c"/>
    <rect width="7.5" height="20" fill="#fff"/>
    <circle cx="19" cy="10" r="5.5" fill="#fff"/>
    <circle cx="21" cy="8.5" r="5" fill="#01411c"/>
    <path d="m22 4 1 2.2 2.4-.2-1.6 1.8.7 2.3-2.1-1.2-2 1.4.5-2.4-1.8-1.6 2.4-.1z" fill="#fff"/>`,
  bn: `
    <rect width="30" height="20" fill="#006a4e"/>
    <circle cx="13.5" cy="10" r="6" fill="#f42a41"/>`,
  ru: `
    <rect width="30" height="20" fill="#fff"/>
    <rect y="6.67" width="30" height="6.67" fill="#0039a6"/>
    <rect y="13.33" width="30" height="6.67" fill="#d52b1e"/>`,
  am: `
    <rect width="30" height="6.67" fill="#078930"/>
    <rect y="6.67" width="30" height="6.67" fill="#fcdd09"/>
    <rect y="13.33" width="30" height="6.67" fill="#da121a"/>
    <circle cx="15" cy="10" r="5.2" fill="#0f47af"/>
    <path d="m15 5.6 2.6 8-6.8-4.9h8.4l-6.8 4.9z" stroke="#fcdd09" stroke-width=".7" fill="none"/>`,
};

export function flagSvg(lang: Lang): string {
  return `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true" focusable="false">${FLAG_BODIES[lang]}</svg>`;
}
