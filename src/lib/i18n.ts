import { EN } from '@/locales/en'
import { SERVER_RULES } from '@/locales/en/server'

export type Lang = 'fr' | 'en'

export const LANG_STORAGE_KEY = 'konvwa-lang'

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    if (stored === 'fr' || stored === 'en') return stored
  } catch {
    /* storage can be blocked: French is the default */
  }
  return 'fr'
}

/** The language is fixed for the lifetime of the page: switching it reloads the app. */
export const LANG: Lang = detectLang()

/** Number / currency formatting (Haitian French keeps the space-grouped thousands). */
export const LOCALE_TAG = LANG === 'en' ? 'en-US' : 'fr-HT'
/** Date formatting. */
export const DATE_LOCALE = LANG === 'en' ? 'en-US' : 'fr-FR'

if (typeof document !== 'undefined') document.documentElement.lang = LANG

/**
 * Translates a French source string. French is the source language, so the string itself is the key:
 * `tr('Annuler')` is 'Annuler' in French and 'Cancel' in English. Placeholders are `{0}`, `{1}`…
 * A missing English entry falls back to the French text (never a blank screen).
 */
export function tr(fr: string, ...args: Array<string | number>): string {
  const base = LANG === 'en' ? (EN[fr] ?? fr) : fr
  return args.length === 0 ? base : base.replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? ''))
}

/** Translates an error message coming from the server (French) into the current language. */
export function trServer(message: string): string {
  if (LANG !== 'en') return message
  if (Object.prototype.hasOwnProperty.call(EN, message)) return EN[message]
  for (const [pattern, template] of SERVER_RULES) {
    const m = message.match(pattern)
    if (m) return template.replace(/\{(\d+)\}/g, (_, i: string) => m[Number(i) + 1] ?? '')
  }
  return message
}

/** Picks the English version of a server-written text when the app is in English and a translation exists. */
export function pickLocalized(fr: string, en: string | null | undefined): string {
  return LANG === 'en' && en ? en : fr
}

/** English plural helper for strings built as `word{s}`: French and English both use the "s" rule here. */
export function plural(count: number): string {
  return count > 1 ? 's' : ''
}

/** True when the user (or a previous visit) explicitly chose a language on this device. */
export function hasStoredLang(): boolean {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    return stored === 'fr' || stored === 'en'
  } catch {
    return false
  }
}

export function setLanguage(lang: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    /* ignore */
  }
  window.location.reload()
}
