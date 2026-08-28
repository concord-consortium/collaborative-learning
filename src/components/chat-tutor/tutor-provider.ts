// Client-side provider selection: turning a query param and a unit-config value into the one
// backend that answers this conversation's turns. The vocabulary itself lives in shared/ because
// the trigger and the unit config schema reference the same list.
import {
  kDefaultTutorProvider, kTutorProviders, TutorProviderId
} from "../../../shared/chat-tutor-providers";

export type { TutorProviderId };

function asTutorProvider(value: string | undefined): TutorProviderId | undefined {
  return kTutorProviders.find(provider => provider === value);
}

// Precedence: query param > unit config > default. An unrecognized value at either level
// is dropped rather than honored — a typo shouldn't select a backend nothing implements,
// and the rules' enum pin would reject the resulting writes anyway.
export function resolveTutorProvider(
  paramValue: string | undefined, configValue: string | undefined
): TutorProviderId {
  return asTutorProvider(paramValue) ?? asTutorProvider(configValue) ?? kDefaultTutorProvider;
}

// The value to stamp on message docs and mix into the conversation id — undefined for the
// default provider. Routing both through here is what guarantees the default case stays a
// no-op, so conversations created before provider selection existed keep resolving to the
// same doc and keep writing the same fields.
export function nonDefaultTutorProvider(provider: TutorProviderId): TutorProviderId | undefined {
  return provider === kDefaultTutorProvider ? undefined : provider;
}

// The two steps composed: precedence first, then the default carve-out. Callers want the
// value to stamp and mix into the conversation id, never the resolved-but-not-yet-carved-out
// one, so this is the entry point the sidebar uses. Composing here rather than at the call
// site is what makes the argument order testable — swapping the two at the call site would
// silently invert the documented param-over-config precedence.
export function sessionTutorProvider(
  paramValue: string | undefined, configValue: string | undefined
): TutorProviderId | undefined {
  return nonDefaultTutorProvider(resolveTutorProvider(paramValue, configValue));
}
