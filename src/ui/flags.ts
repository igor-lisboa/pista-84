import type { Lang } from '../i18n/index.ts';

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
};

export function flagSvg(lang: Lang): string {
  return `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true" focusable="false">${FLAG_BODIES[lang]}</svg>`;
}
