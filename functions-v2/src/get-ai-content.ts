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
import {buildRequestPrompt} from "../../shared/ai-context-tokens";
import {validateUserContext} from "./user-context";

// This function generates and returns tile content from an LLM.
// The prompt provided by the client along with the current summary of student and teacher.
// work in the given class and unit are provided as input.
// The response will be cached and re-used unless the prompt or work summary is updated.

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const model = "gpt-4o-mini";

// update this when deploying updates to this function
const version = "1.0.0";

const lockTimeout = 60 * 1000; // 1 minute

// Bump whenever the code-level system message changes (either instruction below, or the default
// systemPrompt fallback) so a cached response generated under the old wording is regenerated
// rather than reused. Written onto the cached content doc alongside prompt; compared in
// isCachedContentUpToDate.
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

export function isCachedContentUpToDate(prompt: string,
  classInfo: DocumentSnapshot, contentSnapshot: DocumentSnapshot): boolean {
  if (!contentSnapshot.exists) return false;
  const contentData = contentSnapshot.data();
  if (!contentData) return false;
  if (!contentData.lastUpdated) return false;
  if (contentData.promptPolicyVersion !== PROMPT_POLICY_VERSION) return false;
  if (contentData.prompt !== prompt) return false;
  // summaryCreatedAt is absent until a class summary is first generated; absence is not staleness.
  const summaryCreatedAt = classInfo.data()?.summaryCreatedAt;
  if (summaryCreatedAt && contentData.lastUpdated.toMillis() < summaryCreatedAt.toMillis()) return false;
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

function returnCachedContent(cachedContent: DocumentSnapshot) {
  const data = cachedContent.data();
  if (!data) return {error: "No data"};
  return aiContentResponse({
    text: data.content,
    clientRequestHash: data.clientRequestHash,
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

    // Composed before the cache check: the context blocks are part of what was asked, so they are
    // part of the key. Without that, editing a document would no longer invalidate its answer --
    // the summary used to travel inside dynamicContentPrompt and now travels beside it.
    const composedPrompt = buildRequestPrompt(question, contextBlocks, contextTokens ?? [], {
      studentSummary: classInfo.data()?.studentSummary,
      teacherSummary: classInfo.data()?.teacherSummary,
    });

    const aiContentPath = getAIContentPath(firestoreRoot, unit, classHash, documentId, tileId);
    const cachedAIContent = await getFirestore().doc(aiContentPath).get();

    if (isCachedContentUpToDate(composedPrompt, classInfo, cachedAIContent)) {
      return returnCachedContent(cachedAIContent);
    } else {
      return await generateContent(firestoreRoot, unit, classHash, documentId, tileId,
        systemPrompt, composedPrompt, requestHash);
    }
  },
);
