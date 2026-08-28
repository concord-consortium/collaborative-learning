// Client-side provider selection: turning a query param and a unit-config value into the provider
// a conversation is stamped and partitioned by. That is the whole of it on this side — the server
// builds an OpenAI backend unconditionally today, so resolving a non-default provider here picks
// which conversation the turns belong to, not which backend answers them. The vocabulary itself
// lives in shared/ because the unit config schema and, once it routes, the trigger reference the
// same list.
import {
  kDefaultTutorProvider, kTutorProviders, TutorProviderId
} from "../../../shared/chat-tutor-providers";

function asTutorProvider(value: string | undefined): TutorProviderId | undefined {
  return kTutorProviders.find(provider => provider === value);
}

// Precedence: query param > unit config > default. An unrecognized value at either level
// is dropped rather than honored — a typo shouldn't select a backend nothing implements,
// and the rules' enum pin would reject the resulting writes anyway.
//
// Deliberately not exported: it resolves to the default rather than to undefined, so a caller
// reaching for it instead of sessionTutorProvider would stamp "openai" onto message docs and
// break the byte-identical guarantee the default path rests on.
function resolveTutorProvider(
  paramValue: string | undefined, configValue: string | undefined
): TutorProviderId {
  return asTutorProvider(paramValue) ?? asTutorProvider(configValue) ?? kDefaultTutorProvider;
}

// The value to stamp on message docs and mix into the conversation id — undefined for the
// default provider. Routing both through here is what guarantees the default case stays a
// no-op, so conversations created before provider selection existed keep resolving to the
// same doc and keep writing the same fields.
function nonDefaultTutorProvider(provider: TutorProviderId): TutorProviderId | undefined {
  return provider === kDefaultTutorProvider ? undefined : provider;
}

// The module's only entry point: precedence first, then the default carve-out. Keeping the two
// steps private behind it is what stops the carve-out from being bypassed, and composing them
// here rather than at the call site is what makes the argument order testable — swapping the
// two arguments would otherwise silently invert the param-over-config precedence.
export function sessionTutorProvider(
  paramValue: string | undefined, configValue: string | undefined
): TutorProviderId | undefined {
  return nonDefaultTutorProvider(resolveTutorProvider(paramValue, configValue));
}
