// Races a promise against a deadline, so a hung or slower-than-expected generation gets a clean
// error from our own code rather than the 1st-gen function's own 540s platform timeout. Any call
// failure inside `fn` still rejects immediately in the normal way; this only adds an upper bound.
//
// Losing the race does not cancel `fn` -- it keeps running in the background, unobserved, and can
// still make further paid OpenAI calls after this function has already reported failure. Real
// generations finish in minutes, well under the deadline, so this is a known, accepted gap rather
// than an active problem: fixing it means threading cancellation through the whole pipeline down to
// each OpenAI call, which isn't worth it unless the deadline starts firing in practice.
export async function withDeadline<T>(fn: () => Promise<T>, deadlineMs: number, message: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(message)), deadlineMs);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}
