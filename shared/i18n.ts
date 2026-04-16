/** Extract the union of all valid message keys from WXT's generated types */
export type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

/** Thin wrapper around browser.i18n.getMessage for type-safe i18n */
export function t(key: MessageKey, ...substitutions: string[]): string {
  return browser.i18n.getMessage(key, substitutions) || key;
}
