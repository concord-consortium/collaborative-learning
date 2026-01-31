/**
 * Translation/Term Override System
 *
 * This system currently provides term customization within English, NOT full
 * internationalization (i18n). It allows units to override specific terms
 * (e.g., "Group" → "Team", "Student" → "Participant") while keeping the
 * surrounding English text unchanged.
 *
 * We intentionally use simple string interpolation like `Create ${groupTerm}`
 * rather than making entire phrases translation keys. Full i18n would require
 * phrase-level keys with placeholders to handle different grammatical structures
 * across languages, but that's out of scope for the current English-only term
 * customization use case.
 *
 * If multi-language support becomes a requirement, phrases containing
 * translated terms would need to become full translation keys.
 */

import { observable } from "mobx";
import enUS from "./lang/en-us.json";

export type TranslationKeyType = keyof typeof enUS;
export function isTranslationKey(key: string): key is TranslationKeyType {
  return key in enUS;
}

// Module-level MobX observable state for term overrides.
const moduleTermOverrides = observable.box<Record<string, string> | undefined>(undefined);

/**
 * Set module-level term overrides.
 * Call this when the unit configuration loads.
 *
 * After calling this, translate() will use these values by default,
 * eliminating the need to pass options through each call.
 */
export function setTermOverrides(termOverrides?: Record<string, string>): void {
  moduleTermOverrides.set(termOverrides);
}

/**
 * Clear module-level overrides (useful for testing).
 */
export function clearTermOverrides(): void {
  moduleTermOverrides.set(undefined);
}

/**
 * Translate a key to its display string.
 *
 * Resolution order:
 * 1. Module-level termOverrides (set via setTermOverrides())
 * 2. Default value from en-us.json
 * 3. The key itself as fallback
 *
 */
export function translate(key: TranslationKeyType): string {
  const overrides = moduleTermOverrides.get();

  if (overrides?.[key]) {
    return overrides[key];
  }

  return enUS[key as keyof typeof enUS] ?? key;
}

/**
 * Get the default/base value for a key, ignoring any overrides.
 */
export function getDefaultValue(key: TranslationKeyType): string {
  return enUS[key as keyof typeof enUS] ?? key;
}
