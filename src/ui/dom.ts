import { getLang } from '../i18n/index.ts';

/** Looks up an element that the static HTML guarantees to exist. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

export const formatKm = (metres: number): string =>
  (metres / 1000).toLocaleString(getLang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatInteger = (value: number): string => Math.floor(value).toLocaleString(getLang());

export const formatBrl = (value: number): string =>
  value.toLocaleString(getLang(), { style: 'currency', currency: 'BRL' });
