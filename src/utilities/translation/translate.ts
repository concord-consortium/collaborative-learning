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

import enUS from "./lang/en-us.json";
import { TranslationKeyType } from "./translation-types";

export interface TranslateOptions {
  overrides?: Record<string, string>;
  tagPrompt?: string;
  vars?: Record<string, string | number>;
}

// Module-level state for term overrides
let moduleTermOverrides: Record<string, string> | undefined;
let moduleTagPrompt: string | undefined;

// Callback to notify when overrides change (for MobX integration)
let onOverridesChangeCallback: (() => void) | undefined;

/**
 * Set module-level term overrides and tagPrompt.
 * Call this when the unit configuration loads.
 *
 * After calling this, translate() will use these values by default,
 * eliminating the need to pass options through each call.
 */
export function setTermOverrides(
  termOverrides?: Record<string, string>,
  tagPrompt?: string
): void {
  moduleTermOverrides = termOverrides;
  moduleTagPrompt = tagPrompt;

  // Notify observers (triggers MobX re-renders)
  onOverridesChangeCallback?.();
}

/**
 * Register a callback to be notified when term overrides change.
 * Used by MobX stores to trigger re-renders in React components.
 */
export function onTermOverridesChange(callback: () => void): void {
  onOverridesChangeCallback = callback;
}

/**
 * Clear module-level overrides (useful for testing).
 */
export function clearTermOverrides(): void {
  moduleTermOverrides = undefined;
  moduleTagPrompt = undefined;

  // Notify observers (triggers MobX re-renders)
  onOverridesChangeCallback?.();
}

/**
 * Translate a key to its display string.
 *
 * Resolution order:
 * 1. Explicit overrides from options (if provided)
 * 2. Module-level termOverrides (set via setTermOverrides())
 * 3. For "Strategy" key: tagPrompt if available
 * 4. Default value from en-us.json
 * 5. The key itself as fallback
 *
 * For most usage, just call translate(key) - it will use the module-level
 * overrides set at app initialization. Pass explicit options only for
 * special cases like authoring preview.
 */
export function translate(key: TranslationKeyType, options?: TranslateOptions): string {
  const { vars } = options ?? {};

  // Use explicit overrides if provided, otherwise fall back to module-level
  const overrides = options?.overrides ?? moduleTermOverrides;
  const tagPrompt = options?.tagPrompt ?? moduleTagPrompt;

  // 1. Check unit overrides first
  if (overrides?.[key]) {
    return applyVars(overrides[key], vars);
  }

  // 2. Special case: Strategy uses tagPrompt if available
  if (key === "Strategy" && tagPrompt) {
    return applyVars(tagPrompt, vars);
  }

  // 3. Fall back to default from JSON
  const defaultValue = enUS[key as keyof typeof enUS] ?? key;
  return applyVars(defaultValue, vars);
}

/**
 * Apply variable substitution to a string.
 * Supports %{varName} syntax for future use.
 */
function applyVars(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/%\{\s*(\w+)\s*\}/g, (_, name) => String(vars[name] ?? ""));
}
