/** Thin wrapper around browser.i18n.getMessage for type-safe i18n */
export function t(key: string, ...substitutions: string[]): string {
  return browser.i18n.getMessage(key, substitutions) || key;
}
