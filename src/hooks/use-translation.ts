import { useStores } from "./use-stores";
import { translate, TranslationKeyType } from "../utilities/translation";

/**
 * React hook for translating terms.
 *
 * The translate() function uses module-level overrides set at app initialization,
 * so no options need to be passed. This hook observes termOverridesVersion
 * to ensure components re-render when term overrides change.
 *
 * @example
 * const { t } = useTranslation();
 * const groupLabel = t(TranslationKey.Group); // "Group" or custom override
 */
export function useTranslation() {
  const { appConfig } = useStores();

  // Observe termOverridesVersion to trigger re-renders when overrides change.
  // This is a MobX observable that increments whenever setTermOverrides() is called.
  // eslint-disable-next-line unused-imports/no-unused-vars
  const _version = appConfig.termOverridesVersion;

  return {
    t: (key: TranslationKeyType) => translate(key)
  };
}
