/** Thin wrapper around browser.i18n.getMessage for type-safe i18n */
export function t(key: string, ...substitutions: string[]): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return browser.i18n.getMessage(key as any, substitutions) || key;
}
