// import * as admin from "firebase-admin";
import {getFirestore} from "firebase-admin/firestore";
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

function getClassInfoPath(firestoreRoot: string, unit: string, classHash: string): string {
  return `${firestoreRoot}/exemplars/${unit}/classes/${classHash}`;
}

function getDynamicContentPath(firestoreRoot: string, unit: string, classHash: string,
  documentId: string, tileId: string): string {
  return `${getClassInfoPath(firestoreRoot, unit, classHash)}/documents/${documentId}/tiles/${tileId}`;
}

function isDynamicContentUpToDate(dynamicContentPrompt: string,
  classInfo: DocumentSnapshot, dynamicContent: DocumentSnapshot): boolean {
  if (!dynamicContent.exists) return false;
  const dynamicContentData = dynamicContent.data();
  if (!dynamicContentData) return false;
  if (!dynamicContentData.lastUpdated) return false;
  if (dynamicContentData.lastUpdated < classInfo.data()?.lastUpdated) return false;
  if (dynamicContentData.dynamicContentPrompt !== dynamicContentPrompt) return false;
  return true;
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
    const exemplarDataPath = getClassInfoPath(firestoreRoot, unit, classHash);
    const exemplarData = await getFirestore().doc(exemplarDataPath).get();

    const dynamicContentPath = getDynamicContentPath(firestoreRoot, unit, classHash, documentId, tileId);
    const cachedDynamicContent = await getFirestore().doc(dynamicContentPath).get();

    if (isDynamicContentUpToDate(dynamicContentPrompt, exemplarData, cachedDynamicContent)) {
      logger.info("Using cached dynamic content");
      return {
        text: cachedDynamicContent.data()?.dynamicContent,
      };
    } else {
      logger.info("Generating new dynamic content");
      const openai = new ChatOpenAI({
        apiKey: openaiApiKey.value(),
        model,
      });

      const studentSummary = exemplarData.data()?.studentSummary;
      const teacherSummary = exemplarData.data()?.teacherSummary;
      const studentMessage = `Here is a summary of the student work in this class:\n\n${studentSummary}\n\n`;
      const teacherMessage =
        teacherSummary ? `Here is a summary of the teacher work in this class:\n\n ${teacherSummary}\n\n` : "";
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`${dynamicContentPrompt}\n\n${teacherMessage}${studentMessage}`),
      ];

      let dynamicContent = "";
      let errorMessage = "";
      try {
        const response = await openai.invoke(messages);
        dynamicContent = response.content.toString();
      } catch (error) {
        logger.error("Error calling LLM", error);
        errorMessage = error instanceof Error ? error.message : "Unknown error";
      }

      getFirestore().doc(dynamicContentPath).set({
        dynamicContent,
        dynamicContentPrompt,
        lastUpdated: new Date(),
      });

      return {
        text: dynamicContent,
        error: errorMessage,
      };
    }
  }
);
