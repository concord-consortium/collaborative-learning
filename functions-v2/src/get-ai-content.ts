// import * as admin from "firebase-admin";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {CallableRequest, onCall, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {DocumentSnapshot} from "firebase-functions/v2/firestore";
import {ChatOpenAI} from "@langchain/openai";
import {HumanMessage, SystemMessage} from "@langchain/core/messages";
import {IAiContentUnionParams, isWarmUpParams} from "../../shared/shared";
import {withCurriculumInstructions} from "../../shared/unit-summary-slice";
import {buildRequestPrompt, classSummaryBlocks} from "../../shared/ai-context-tokens";
import {validateUserContext} from "./user-context";

// This function generates and returns tile content from an LLM.
// The caller sends its question, the context it resolved for itself, and the contexts it wants;
// the class and teacher summaries are added here, and only for a question that named them.
// The response is cached and re-used until the composed prompt changes.

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const model = "gpt-4o-mini";

// update this when deploying updates to this function
const version = "1.0.0";

const lockTimeout = 60 * 1000; // 1 minute

// Bump whenever what this sends the model changes shape without the authored prompt changing:
// the code-level system message (either instruction below, or the default systemPrompt fallback),
// or how the request itself is composed. A cached response built under the old shape is then
// regenerated rather than reused. Written onto the cached content doc alongside prompt; compared
// in isCachedContentUpToDate.
export const PROMPT_POLICY_VERSION = 3;

export function buildSystemMessageText(systemPrompt: string | undefined): string {
  return withCurriculumInstructions(systemPrompt || "You are a helpful, collaborative student.", "the student");
}

function getClassInfoPath(firestoreRoot: string, unit: string, classHash: string): string {
  return `${firestoreRoot}/aicontent/${unit}/classes/${classHash}`;
}

function getAIContentPath(firestoreRoot: string, unit: string, classHash: string,
  documentId: string, tileId: string): string {
  return `${getClassInfoPath(firestoreRoot, unit, classHash)}/documents/${documentId}/tiles/${tileId}`;
}

// We use a lock file to prevent two threads from updating the same AI content at the same time.
function getLockPath(firestoreRoot: string, unit: string, classHash: string, documentId: string,
  tileId: string): string {
  return getAIContentPath(firestoreRoot, unit, classHash, documentId, tileId) + "-LOCK";
}

/**
 * Whether the stored answer still answers this request.
 *
 * The prompt comparison is the whole test. A class or teacher summary is inside the composed
 * prompt exactly when it was asked for, so a regenerated summary changes the prompt and is caught
 * here. Comparing the class doc's summaryCreatedAt as well would additionally throw away every
 * tile's answer each time the summarizer runs, including prompts that never name class work --
 * paid regenerations of a byte-identical prompt.
 *
 * @param {string} prompt the composed prompt this request would send
 * @param {DocumentSnapshot} contentSnapshot the stored answer
 * @return {boolean} true when the stored answer can be returned as is
 */
export function isCachedContentUpToDate(
  prompt: string, contentSnapshot: DocumentSnapshot
): boolean {
  if (!contentSnapshot.exists) return false;
  const contentData = contentSnapshot.data();
  if (!contentData) return false;
  if (!contentData.lastUpdated) return false;
  if (contentData.promptPolicyVersion !== PROMPT_POLICY_VERSION) return false;
  if (contentData.prompt !== prompt) return false;
  return true;
}

/**
 * Everything a caller is given back, and the one place that decides it.
 *
 * It must never carry the prompt. The composed prompt holds the class and teacher summaries,
 * firestore.rules lets only teachers read those, and the contexts to compose are named by the
 * caller -- so a returned prompt would hand any student the class summary for the asking. Both
 * answer paths build their response here so neither can grow the field back on its own.
 *
 * Callers still need to know which request they are being answered: waitForContent returns
 * whatever the lock holder generated, which under contention can be an answer for a different
 * revision of this tile. The hash identifies it without disclosing it.
 *
 * @param {object} fields the answer, its requester's hash, when it was written, and any error
 * @return {object} the callable's response
 */
export function aiContentResponse(
  fields: {text: string, clientRequestHash?: string, lastUpdated?: unknown, error: string | null}
) {
  return {
    text: fields.text,
    clientRequestHash: fields.clientRequestHash ?? null,
    lastUpdated: fields.lastUpdated,
    error: fields.error,
  };
}

/**
 * `clientRequestHash` tells the client which request an answer belongs to, so it can tell its own
 * answer from one already on screen.
 *
 * Pass `callerRequestHash` whenever the caller's own request is known to match the stored answer.
 * The client's hash covers more than the composed prompt does -- the system prompt, surrounding
 * whitespace, a named token whose block is empty -- so two different client hashes can share one
 * composed prompt. Returning the stored hash in that case never matches what the caller sent, and
 * the client re-requests on every mount for as long as the answer is cached.
 *
 * It is omitted when waiting on another thread's lock, where the answer belongs to the request
 * that held the lock rather than to this one, and the stored hash is the only honest answer.
 *
 * @param {DocumentSnapshot} cachedContent the stored answer
 * @param {string} callerRequestHash the caller's own hash, when it matches the stored answer
 * @return {object} the callable's response, carrying no part of the stored prompt
 */
export function returnCachedContent(cachedContent: DocumentSnapshot, callerRequestHash?: string) {
  const data = cachedContent.data();
  if (!data) return {error: "No data"};
  return aiContentResponse({
    text: data.content,
    clientRequestHash: callerRequestHash ?? data.clientRequestHash,
    lastUpdated: data.lastUpdated,
    error: null,
  });
}

async function generateContent(firestoreRoot: string, unit: string, classHash: string,
  documentId: string, tileId: string, systemPrompt: string, composedPrompt: string,
  requestHash: string | undefined) {
  // The Firebase function is often called multiple times in quick succession
  // (because multiple copies of the same tile are being rendered)
  // but we want to avoid calling the LLM multiple times. So we use a lock
  // that only one thread can hold at a time.
  const lockRef = getFirestore().doc(getLockPath(firestoreRoot, unit, classHash, documentId, tileId));
  const expiresAt = Date.now() + lockTimeout;

  let strategy: string;
  try {
    // Attempt to acquire the lock; this is an atomic operation that will fail if the lock already exists.
    await lockRef.create({expiresAt});
    // Lock acquired
    strategy = "PROCEED";
  } catch (error) {
    logger.info("Document is locked:", (error as Error).message);
    // Lock exists; check if it is current or has expired.
    strategy = await getFirestore().runTransaction(async (tx) => {
      const lock = await tx.get(lockRef);
      if (lock.exists) {
        const lockData = lock.data();
        if (lockData && lockData.expiresAt && lockData.expiresAt > Date.now()) {
          // It's a valid lock; we just have to wait for it to be released.
          return "WAIT";
        } else {
          // Lock is stale - steal it.
          logger.info("Lock is stale; stealing it");
          tx.update(lockRef, {expiresAt});
          return "PROCEED";
        }
      } else {
        // Lock disappeared - must have just been released by another thread which generated content.
        return "USE-CACHE";
      }
    });
  }

  if (strategy === "WAIT" || strategy === "USE-CACHE") {
    const result = await waitForContent(firestoreRoot, unit, classHash, documentId, tileId);
    return returnCachedContent(result);
  }

  // strategy is "PROCEED"; we have the lock and can proceed to generate content.
  logger.info("Generating new AI content");
  const openai = new ChatOpenAI({
    apiKey: openaiApiKey.value(),
    model,
  });

  const messages = [
    new SystemMessage(buildSystemMessageText(systemPrompt)),
    new HumanMessage(composedPrompt),
  ];

  let content = "";
  let errorMessage = "";
  const lastUpdated = Timestamp.now();
  try {
    const response = await openai.invoke(messages);
    content = response.content.toString();
  } catch (error) {
    logger.error("Error calling LLM", error);
    errorMessage = error instanceof Error ? error.message : "Unknown error";
  }

  const aiContentPath = getAIContentPath(firestoreRoot, unit, classHash, documentId, tileId);
  await getFirestore().doc(aiContentPath).set({
    content,
    prompt: composedPrompt,
    promptPolicyVersion: PROMPT_POLICY_VERSION,
    clientRequestHash: requestHash ?? null,
    lastUpdated,
  });

  await lockRef.delete();

  // The Firestore write above keeps the prompt; that copy is what the cache comparison reads.
  return aiContentResponse({
    text: content, clientRequestHash: requestHash, lastUpdated, error: errorMessage,
  });
}

// If we're waiting on a lock, poll every second until it is released.
async function waitForContent(firestoreRoot: string, unit: string, classHash: string,
  documentId: string, tileId: string): Promise<DocumentSnapshot> {
  const lockPath = getLockPath(firestoreRoot, unit, classHash, documentId, tileId);
  const lock = await getFirestore().doc(lockPath).get();
  if (!lock.exists) {
    const aiContentPath = getAIContentPath(firestoreRoot, unit, classHash, documentId, tileId);
    return await getFirestore().doc(aiContentPath).get();
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const result = await waitForContent(firestoreRoot, unit, classHash, documentId, tileId);
  return result;
}

export const getAiContent = onCall(
  {
    secrets: [openaiApiKey],
    maxInstances: 2, // Limit how many requests we are sending to OpenAI at once
    concurrency: 3,
  },
  async (request: CallableRequest<IAiContentUnionParams>) => {
    const params = request.data;
    if (isWarmUpParams(params)) return {version};
    const {context: userContext, dynamicContentPrompt: question, systemPrompt,
      unit, documentId, tileId, contextBlocks, contextTokens, requestHash} = params || {};

    const validatedUserContext = validateUserContext(userContext, request.auth);
    const {isValid, uid, firestoreRoot} = validatedUserContext;
    if (!isValid || !userContext?.classHash || !uid) {
      throw new HttpsError("invalid-argument", "The provided user context is not valid.");
    }

    const classHash = userContext.classHash;
    const classInfoPath = getClassInfoPath(firestoreRoot, unit, classHash);
    const classInfo = await getFirestore().doc(classInfoPath).get();

    // Composed before the cache check, because the context blocks are part of what was asked and
    // so part of the key. Keying on the question alone would leave an edited document answered by
    // the summary of an earlier one.
    const composedPrompt = buildRequestPrompt(
      question, contextBlocks, contextTokens ?? [], classSummaryBlocks(classInfo.data())
    );

    const aiContentPath = getAIContentPath(firestoreRoot, unit, classHash, documentId, tileId);
    const cachedAIContent = await getFirestore().doc(aiContentPath).get();

    if (isCachedContentUpToDate(composedPrompt, cachedAIContent)) {
      return returnCachedContent(cachedAIContent, requestHash);
    } else {
      return await generateContent(firestoreRoot, unit, classHash, documentId, tileId,
        systemPrompt, composedPrompt, requestHash);
    }
  },
);
