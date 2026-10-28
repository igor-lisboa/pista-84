// Small code-native icons: inherit the arcade palette instead of platform emoji rendering.
const PATHS = {
  close: '<path d="m6 3 6 6 6-6 3 3-6 6 6 6-3 3-6-6-6 6-3-3 6-6-6-6z"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M7 5h3v14H7zm7 0h3v14h-3z"/>',
  left: '<path d="m16 5-10 7 10 7z"/>',
  right: '<path d="m8 5 10 7-10 7z"/>',
  arrow: '<path d="M4 11h12l-5-5 2-2 8 8-8 8-2-2 5-5H4z"/>',
  settings: '<path d="M10 2h4l1 4 4-1 2 4-3 3 3 3-2 4-4-1-1 4h-4l-1-4-4 1-2-4 3-3-3-3 2-4 4 1z"/><circle cx="12" cy="12" r="3" fill="var(--ink2)"/>',
  fuel: '<path d="M3 3h11v17H2v-2h1zm2 2v6h7V5zm10 2 2-2 5 5v8a3 3 0 0 1-6 0v-4h-2v-2h4v6a1 1 0 0 0 2 0v-7z"/>',
  coins: '<path d="m12 2 10 10-10 10L2 12zm0 4-6 6 6 6 6-6z"/>',
  controller: '<path d="M6 5h12l4 13-3 2-5-5h-4l-5 5-3-2zm1 3v3H4v2h3v3h2v-3h3v-2H9V8zm9 1v3h3V9z"/>',
  info: '<path d="M10 2h4v4h-4zm-1 6h5v10h2v3H8v-3h2v-7H9z"/>',
  restart: '<path d="M12 5V2L7 7l5 5V9a5 5 0 1 1-5 5H4a8 8 0 1 0 8-9z"/>',
  trophy: '<path d="M6 3h12v3h3v4a4 4 0 0 1-4 4h-.3A6 6 0 0 1 13 17.9V20h3v2H8v-2h3v-2.1A6 6 0 0 1 7.3 14H7a4 4 0 0 1-4-4V6h3zm-1 5v2a2 2 0 0 0 1 1.7V8zm14 0h-1v3.7A2 2 0 0 0 19 10z"/>',
  curve: '<path d="M4 21v-9a7 7 0 0 1 7-7h3V1l8 6-8 6V9h-3a3 3 0 0 0-3 3v9z"/>',
} as const;

export function icon(name: keyof typeof PATHS): string {
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
}

export function applyIcons(): void {
  for (const element of document.querySelectorAll<HTMLElement>('[data-icon]')) {
    const name = element.dataset.icon as keyof typeof PATHS;
    if (name in PATHS) element.innerHTML = icon(name);
  }
}
