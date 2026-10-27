import type { ptBR } from './locales/pt-BR.ts';

/** Every translatable string key, derived from the source language. */
export type MessageKey = keyof typeof ptBR;

/** A locale may translate only some keys; missing ones fall back to pt-BR. */
export type Messages = Partial<Record<MessageKey, string>>;

export type Lang = 'pt-BR' | 'en' | 'pt-PT' | 'fr' | 'it' | 'ja' | 'de';

export type MessageVars = Readonly<Record<string, string | number>>;
