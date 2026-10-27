import { de } from './locales/de.ts';
import { en } from './locales/en.ts';
import { fr } from './locales/fr.ts';
import { it } from './locales/it.ts';
import { ja } from './locales/ja.ts';
import { ptBR } from './locales/pt-BR.ts';
import { ptPT } from './locales/pt-PT.ts';
import type { Lang, MessageKey, MessageVars, Messages } from './types.ts';

export type { Lang, MessageKey, MessageVars } from './types.ts';

/** Native names shown in the language picker, in display order. */
export const LANGS: Readonly<Record<Lang, string>> = {
  'pt-BR': 'Português (Brasil)',
  en: 'English',
  'pt-PT': 'Português (Portugal)',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  de: 'Deutsch',
};

const SOURCE_LANG: Lang = 'pt-BR';
const FALLBACK_LANG: Lang = 'en';

export const LOCALES: Readonly<Record<Lang, Messages>> = {
  'pt-BR': ptBR,
  en,
  'pt-PT': ptPT,
  fr,
  it,
  ja,
  de,
};

let current: Lang = SOURCE_LANG;

export const isLang = (value: unknown): value is Lang =>
  typeof value === 'string' && Object.hasOwn(LANGS, value);

export const getLang = (): Lang => current;

/** Picks the best supported language for a list of BCP-47 tags (e.g. `navigator.languages`). */
export function detectLang(preferred: readonly string[] = []): Lang {
  for (const tag of preferred) {
    if (isLang(tag)) return tag;
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'pt') return /^pt-pt$/i.test(tag) ? 'pt-PT' : 'pt-BR';
    const match = (Object.keys(LANGS) as Lang[]).find((lang) => lang.toLowerCase() === base);
    if (match) return match;
  }
  return FALLBACK_LANG;
}

export function setLang(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
}

/** Translates a key, filling `{name}` placeholders; falls back to pt-BR, then to the key itself. */
export function t(key: MessageKey, vars: MessageVars = {}): string {
  const text = LOCALES[current][key] ?? ptBR[key];
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in vars ? String(vars[name]) : placeholder,
  );
}

// Keys built from ids (car taglines, paint names) are validated at the call site.
export const carTagline = (carId: string): string => t(`tag.${carId}` as MessageKey);
export const paintName = (paintId: string): string => t(`paint.${paintId}` as MessageKey);

/**
 * Applies `data-i18n` (text content) and `data-i18n-aria` (aria-label) to a DOM
 * subtree; on the whole document it also updates the title and description.
 */
export function applyStatic(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n as MessageKey);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAria as MessageKey));
  }
  if (root === document) {
    document.title = t('title');
    document.querySelector('meta[name=description]')?.setAttribute('content', t('description'));
  }
}
