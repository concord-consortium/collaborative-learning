/**
 * The vocabulary an author uses to say which context a prompt is evaluated against.
 *
 * A token names a context; it is not a macro that pastes content where it appears. The content is
 * assembled separately by buildContextSection, and the token itself becomes a noun phrase so the
 * authored sentence still reads as prose.
 */
export type AiContextToken =
  "curriculum" | "problem" | "classwork" | "teacherwork" | "mywork";

/** Assembly order for context blocks. Fixed, so block order never depends on where an author typed. */
export const kAiContextTokens: AiContextToken[] =
  ["curriculum", "problem", "classwork", "teacherwork", "mywork"];

/**
 * Students cannot read the class summary doc (firestore.rules restricts it to authed teachers), so
 * these two are resolved on the server and the rest on the client.
 */
export const kServerResolvedTokens: AiContextToken[] = ["classwork", "teacherwork"];

/** What a prompt means when it names no token at all: today's client behaviour, minus class work. */
export const kDefaultTokens: AiContextToken[] = ["curriculum", "mywork"];

/** What each token is replaced with in the prompt text. */
export const kTokenPhrases: Record<AiContextToken, string> = {
  curriculum: "the unit curriculum",
  problem: "this problem",
  classwork: "the class's work",
  teacherwork: "the teacher's materials",
  mywork: "this document",
};

export type AiContextBlocks = Partial<Record<AiContextToken, string>>;

const kTokenSource = "\\{\\{(\\w+)\\}\\}";

function isAiContextToken(name: string): name is AiContextToken {
  return (kAiContextTokens as string[]).includes(name);
}

/** Which contexts a prompt names. Drives what to resolve and whether the client gate applies. */
export function tokensUsed(prompt: string): Set<AiContextToken> {
  const found = new Set<AiContextToken>();
  // A fresh regex per call: a shared global one carries lastIndex between calls.
  const re = new RegExp(kTokenSource, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(prompt)) !== null) {
    if (isAiContextToken(match[1])) found.add(match[1]);
  }
  return found;
}

/** The contexts to send: those the prompt names, or the default pair when it names none. */
export function requestedTokens(prompt: string): Set<AiContextToken> {
  const used = tokensUsed(prompt);
  return used.size > 0 ? used : new Set(kDefaultTokens);
}

/**
 * Replaces each known token with its noun phrase. An unrecognized name is left as literal text, so a
 * typo surfaces in the response where an author can see it instead of being silently swallowed.
 */
export function substituteContext(prompt: string): string {
  const replace = (replacement: (token: AiContextToken) => string) =>
    prompt.replace(new RegExp(kTokenSource, "g"), (match, name: string) =>
      isAiContextToken(name) ? replacement(name) : match);
  // A prompt that is nothing but tokens has no question for the phrases to sit in; they would be a
  // dangling noun. Send the contexts and no invented question.
  if (!replace(() => "").trim()) return "";
  return replace(token => kTokenPhrases[token]);
}
