// Firebase aborts a transaction outright when a set() lands on an overlapping path while the
// transaction is in flight, and reports it as an error whose message is exactly "set".
const kSetAbortMessage = "set";

const kDefaultRetries = 3;

/**
 * Runs a Firebase transaction, retrying if it is aborted by a concurrent `set()`.
 *
 * A transaction retries by itself when the data under it changes, but a `set()` on an overlapping
 * path aborts it instead, and the caller sees that as a failure. Running it again is safe for an
 * update that reads the current value and applies a change to it: the retry sees whatever the
 * `set()` wrote and works from there.
 *
 * Any other failure is thrown straight away rather than retried.
 */
export async function retryAbortedTransaction(
  runTransaction: () => Promise<unknown>, retries = kDefaultRetries
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await runTransaction();
      return;
    } catch (error) {
      const abortedBySet = (error as Error)?.message === kSetAbortMessage;
      if (!abortedBySet || attempt >= retries) throw error;
    }
  }
}
