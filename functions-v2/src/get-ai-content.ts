// import * as admin from "firebase-admin";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {CallableRequest, onCall, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {DocumentSnapshot} from "firebase-functions/v2/firestore";
import {ChatOpenAI} from "@langchain/openai";
import {HumanMessage, SystemMessage} from "@langchain/core/messages";
import {IAiContentUnionParams, isWarmUpParams} from "../../shared/shared";
import {validateUserContext} from "./user-context";

// This function generates and returns tile content from an LLM.
// The prompt provided by the client along with the current summary of student and teacher.
// work in the given class and unit are provided as input.
// The response will be cached and re-used unless the prompt or work summary is updated.

const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Note we are currently using this fixed system prompt
// TODO: perhaps this should be set in the unit configuration.
const systemPrompt = "You are a helpful assistant teacher in a 6th grade classroom.";

const model = "gpt-4o-mini";

// update this when deploying updates to this function
const version = "1.0.0";

const lockTimeout = 60 * 1000; // 1 minute

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

function isCachedContentUpToDate(dynamicContentPrompt: string,
  classInfo: DocumentSnapshot, dynamicContent: DocumentSnapshot): boolean {
  if (!dynamicContent.exists) return false;
  const dynamicContentData = dynamicContent.data();
  if (!dynamicContentData) return false;
  if (!dynamicContentData.lastUpdated) return false;
  if (dynamicContentData.lastUpdated < classInfo.data()?.lastUpdated) return false;
  if (dynamicContentData.dynamicContentPrompt !== dynamicContentPrompt) return false;
  return true;
}

function returnCachedContent(cachedContent: DocumentSnapshot) {
  const data = cachedContent.data();
  if (data) {
    return {
      text: data.dynamicContent,
      lastUpdated: data.lastUpdated,
      error: null,
    };
  } else {
    return {
      error: "No data",
    };
  }
}

async function generateContent(firestoreRoot: string, unit: string, classHash: string,
  documentId: string, tileId: string, dynamicContentPrompt: string, classInfo: DocumentSnapshot) {
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
    console.log("Got result after wait");
    return returnCachedContent(result);
  }

  // strategy is "PROCEED"; we have the lock and can proceed to generate content.
  logger.info("Generating new AI content");
  const openai = new ChatOpenAI({
    apiKey: openaiApiKey.value(),
    model,
  });

  const studentSummary = classInfo.data()?.studentSummary;
  const teacherSummary = classInfo.data()?.teacherSummary;
  const studentMessage = `Here is a summary of the student work in this class:\n\n${studentSummary}\n\n`;
  const teacherMessage =
    teacherSummary ? `Here is a summary of the teacher work in this class:\n\n ${teacherSummary}\n\n` : "";
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`${dynamicContentPrompt}\n\n${teacherMessage}${studentMessage}`),
  ];

  let dynamicContent = "";
  let errorMessage = "";
  const lastUpdated = Timestamp.now();
  try {
    const response = await openai.invoke(messages);
    dynamicContent = response.content.toString();
  } catch (error) {
    logger.error("Error calling LLM", error);
    errorMessage = error instanceof Error ? error.message : "Unknown error";
  }

  const aiContentPath = getAIContentPath(firestoreRoot, unit, classHash, documentId, tileId);
  await getFirestore().doc(aiContentPath).set({
    dynamicContent,
    dynamicContentPrompt,
    lastUpdated,
  });

  await lockRef.delete();

  return {
    text: dynamicContent,
    lastUpdated,
    error: errorMessage,
  };
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
    const {context: userContext, dynamicContentPrompt, unit, documentId, tileId} = params || {};

    const validatedUserContext = validateUserContext(userContext, request.auth);
    const {isValid, uid, firestoreRoot} = validatedUserContext;
    if (!isValid || !userContext?.classHash || !uid) {
      throw new HttpsError("invalid-argument", "The provided user context is not valid.");
    }

    const classHash = userContext.classHash;
    const classInfoPath = getClassInfoPath(firestoreRoot, unit, classHash);
    const classInfo = await getFirestore().doc(classInfoPath).get();

    const aiContentPath = getAIContentPath(firestoreRoot, unit, classHash, documentId, tileId);
    const cachedAIContent = await getFirestore().doc(aiContentPath).get();

    if (isCachedContentUpToDate(dynamicContentPrompt, classInfo, cachedAIContent)) {
      logger.info("Using cached AI content");
      return returnCachedContent(cachedAIContent);
    } else {
      return await generateContent(firestoreRoot, unit, classHash, documentId, tileId, dynamicContentPrompt, classInfo);
    }
  },
);
