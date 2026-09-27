import { getDatabase } from "firebase-admin/database";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { documentSummarizer } from "./ai-summarizer/ai-summarizer";
import { documentHasStudentWork } from "./ai-analysis-classify";
import { getUnitSummary } from "./get-unit-summary";

// Finds classes that have updated documents for selected units,
// and uses an LLM to create a summary of all the student work in Firestore.

// For initial testing, we are limiting which parts of the database this runs on.
// A list of portals and demo areas can be given to scan.
// The list of units is also limited to the ones that have exemplars.

const portals: string[] = ["learn.concord.org"]; // Consider all classes on production.
const demos = ["AITEST"]; // Consider only classes in this demo area.
const units = ["qa-config-subtabs", "mods"]; // only scan these units.

function firebaseBasePath(portal: string|undefined, demo: string|undefined): string {
  return demo
    ? `/demo/${demo}/portals/demo`
    : `/authed/portals/${portal?.replace(/\./g, "_")}`;
}

function firestoreBasePath(portal: string|undefined, demo: string|undefined): string {
  return demo
    ? `demo/${demo}`
    : `authed/${portal?.replace(/\./g, "_")}`;
}

interface Logger {
  info(...args: any[]): void;
}

interface IClassData {
  userCount: number;
  userIds: Set<string>;
  documentCount: number;
  documents: Set<{
    uid: string, key: string, isTeacherDocument: boolean, investigation?: string, problem?: string,
    // The same per-document RTDB value the class-level lastEditedAt below is maxed from -- kept
    // here too since determining whether one specific document has ever been edited needs its own
    // value, not the class-wide max. null when the field has never been written for this document.
    lastEditedAt: number | null
  }>;
  lastEditedAt: number;
}

// Query Firestore for the list of teachers in a class.
async function getClassTeachers(portal: string|undefined, demo: string|undefined, contextId: string, logger: Logger):
    Promise<string[]> {
  const classRef = getFirestore().doc(`${firestoreBasePath(portal, demo)}/classes/${contextId}`);
  const classDoc = await classRef.get();
  return classDoc.data()?.teachers || [];
}

// Query Firestore for all user documents in the unit, and return info by classroom.
// Optional "onlyContextId" parameter can be used to limit the query to a single class.
async function getClassDocumentData(portal: string|undefined, demo: string|undefined, unit: string,
    logger: Logger, onlyContextId?: string):
    Promise<{ [contextId: string]: IClassData }> {
  const classData: { [contextId: string]: IClassData } = {};
  const classTeachers: { [contextId: string]: string[] } = {};

  const documentsPath = firestoreBasePath(portal, demo) + "/documents";

  // Query documents to see which classes need exemplar updates
  let documentQuery = getFirestore()
    .collection(documentsPath)
    .where("unit", "==", unit)
    .select("context_id", "uid", "key", "investigation", "problem");
  if (onlyContextId) {
    documentQuery = documentQuery.where("context_id", "==", onlyContextId);
  }

  try {
    const documentSnapshots = await documentQuery.get();
    for (const doc of documentSnapshots.docs) {
      const data = doc.data();
      const contextId = data.context_id;
      const uid = data.uid;
      const key = data.key;
      const investigation = data.investigation as string | undefined;
      const problem = data.problem as string | undefined;

      if (!(contextId in classTeachers)) {
        classTeachers[contextId] = await getClassTeachers(portal, demo, contextId, logger);
      }

      const isTeacherDocument = classTeachers[contextId].includes(uid);

      const lastEditedPath
        = `${firebaseBasePath(portal, demo)}/classes/${contextId}/users/${uid}/documentMetadata/${key}/lastEditedAt`;
      const documentSnapshot = await getDatabase().ref(lastEditedPath).once("value");
      const lastEdited = documentSnapshot.exists() ? Number(documentSnapshot.val()) : null;

      if (!classData[contextId]) {
        classData[contextId] = { userCount: 0, userIds: new Set(),
          documentCount: 0, documents: new Set(), lastEditedAt: 0 };
      }
      const record = classData[contextId];
      record.userIds.add(uid);
      record.documentCount++;
      record.documents.add({ uid, key, isTeacherDocument, investigation, problem, lastEditedAt: lastEdited });
      if (lastEdited && lastEdited > record.lastEditedAt) {
        record.lastEditedAt = lastEdited;
      }
    }
  } catch (error) {
    logger.info('Error querying documents:', error);
    return classData;
  }
  for (const contextId in classData) {
    classData[contextId].userCount = classData[contextId].userIds.size;
  }
  return classData;
}

function getClassDataDoc(portal: string|undefined, demo: string|undefined, unit: string, contextId: string) {
  return getFirestore().doc(`${firestoreBasePath(portal, demo)}/aicontent/${unit}/classes/${contextId}`);
}

// Retrieve document content from Firebase Realtime Database
async function retrieveDocumentFromFirebase(portal: string|undefined, demo: string|undefined, contextId: string,
    uid: string, key: string): Promise<{ content: any | null, changeCount: number | null, error: string | null }> {
  try {
    const documentPath = `${firebaseBasePath(portal, demo)}/classes/${contextId}/users/${uid}/documents/${key}`;
    const documentSnapshot = await getDatabase().ref(documentPath).once("value");
    const documentData = documentSnapshot.val();

    if (!documentData) {
      return({ content: null, changeCount: null, error: `No document found at path: ${documentPath}` });
    }
    // createDocument (src/lib/db.ts) never writes this field; only a real content sync
    // (use-document-sync-to-firebase.ts) does, starting at 1 on the first one. Read here
    // regardless of whether content itself parses, so a parse failure doesn't also lose it.
    const changeCount = typeof documentData.changeCount === "number" ? documentData.changeCount : null;

    let parsedContent: any = null;
    if (documentData.content) {
      try {
        parsedContent = JSON.parse(documentData.content);
        return({ content: parsedContent, changeCount, error: null });
      } catch (parseError) {
        return({ content: null, changeCount, error: `Failed to parse document content: ${parseError}` });
      }
    } else {
      return({ content: null, changeCount, error: "Document has no content field" });
    }

  } catch (error) {
    return({ content: null, changeCount: null, error: `Error retrieving document from Firebase: ${error}` });
  }
}

async function retrieveAndSummarizeDocument(portal: string|undefined, demo: string|undefined, contextId: string,
    uid: string, key: string, logger: Logger): Promise<{ summary: string, content: any, changeCount: number | null }> {
  const document = await retrieveDocumentFromFirebase(portal, demo, contextId, uid, key);
  if (document.error) {
    logger.info(`Error retrieving document (${contextId}/${uid}/${key}) from Firebase: ${document.error}`);
  }
  const summary = documentSummarizer(document.content, { includeModel: false, minimal: true });
  return { summary, content: document.content, changeCount: document.changeCount };
}

// Whether a document has been edited since it was created, as opposed to still holding only
// whatever createDocument wrote at creation time (including an authored defaultDocumentTemplate,
// which createDocument can populate `content` with directly). createDocument never writes
// `changeCount`; only a real content sync does, via document.incChangeCount(), which returns 1 on
// its first call. `lastEditedAt` is registered no earlier than that same first sync (it is set up
// as an onDisconnect handler inside the sync mutation, then only written -- on disconnect or
// unmount -- once that handler exists), so it is kept here too for a document saved before
// changeCount existed. Either one being present is sufficient; documentHasStudentWork alone cannot
// tell a pre-authored template's content (a welcome message, a worked example, an empty Table --
// which counts unconditionally, see tileCountsAsStudentWork) apart from a student's own work, since
// both look identical the instant the document is auto-created (CLUE-678 PR review).
function documentHasStudentEdits(
  { changeCount, lastEditedAt }: { changeCount: number | null, lastEditedAt: number | null }
): boolean {
  return (changeCount != null && changeCount >= 1) || lastEditedAt != null;
}

// The furthest-along ordinal (in authored order, never sorted as strings) among the given
// problem ordinals, or undefined if none of them appear in the unit's live problem list or the
// list itself is unavailable. "Furthest along" is the upper bound of what any student in the
// class has encountered -- see shared/get-unit-summary.ts and the plan's Teacher Summary section.
async function determineCurrentProblemOrdinal(unit: string, qualifyingOrdinals: string[]): Promise<string | undefined> {
  if (qualifyingOrdinals.length === 0) return undefined;
  const unitSummaryResult = await getUnitSummary(unit);
  if (!unitSummaryResult) return undefined;
  const { liveProblems } = unitSummaryResult;
  let furthestIndex = -1;
  for (const ordinal of qualifyingOrdinals) {
    const index = liveProblems.findIndex((p) => p.ordinal === ordinal);
    if (index > furthestIndex) furthestIndex = index;
  }
  return furthestIndex === -1 ? undefined : liveProblems[furthestIndex].ordinal;
}

// Check if our data document under /exemplars is older than the latest document saved in the class.
async function dataDocNeedsUpdate(portal: string|undefined, demo: string|undefined, unit: string,
    contextId: string, classData: IClassData) {
  if (classData.userCount < 2 || !classData.lastEditedAt) return false;
  const doc = getClassDataDoc(portal, demo, unit, contextId);
  const current = await doc.get();
  if (current.exists && current.data()?.lastEditedAt >= classData.lastEditedAt) {
    return false;
  }
  return true;
}

async function updateClassDataDoc(portal: string|undefined, demo: string|undefined, unit: string,
    contextId: string, data: IClassData, logger: Logger) {
  logger.info(`Updating class data doc for ${unit} ${contextId}`);

  // Retrieve and summarize the documents
  const teacherDocs = Array.from(data.documents).filter(({isTeacherDocument}) => isTeacherDocument);
  const studentDocs = Array.from(data.documents).filter(({isTeacherDocument}) => !isTeacherDocument);
  const teacherResults = await Promise.all(teacherDocs.map(async ({uid, key}) =>  {
    return await retrieveAndSummarizeDocument(portal, demo, contextId, uid, key, logger);
  }));
  const studentResults = await Promise.all(studentDocs.map(async ({uid, key}) =>  {
    return await retrieveAndSummarizeDocument(portal, demo, contextId, uid, key, logger);
  }));
  const teacherContent = teacherResults.map(({summary}) => summary).join("\n\n");
  const studentContent = studentResults.map(({summary}) => summary).join("\n\n");

  // A student document counts toward the class's current problem when it has curriculum fields
  // (a personal document has none), its content has student work, and it has actually been
  // edited since it was created (documentHasStudentEdits) -- content alone cannot tell a
  // student's own work apart from whatever createDocument wrote at creation time, including an
  // authored defaultDocumentTemplate. Teacher documents are excluded: teachers may preview ahead
  // of the class.
  const qualifyingOrdinals = studentDocs
    .map(({investigation, problem, lastEditedAt}, i) =>
      ({investigation, problem, content: studentResults[i].content, changeCount: studentResults[i].changeCount,
        lastEditedAt}))
    .filter(({investigation, problem, content, changeCount, lastEditedAt}) =>
      !!investigation && !!problem &&
      documentHasStudentWork(content) &&
      documentHasStudentEdits({changeCount, lastEditedAt}))
    .map(({investigation, problem}) => `${investigation}.${problem}`);
  const currentProblemOrdinal = await determineCurrentProblemOrdinal(unit, qualifyingOrdinals);

  return getClassDataDoc(portal, demo, unit, contextId).set({
    lastEditedAt: data.lastEditedAt,
    userCount: data.userCount,
    documentCount: data.documentCount,
    teacherContent,
    studentContent,
    summary: null,
    ...(currentProblemOrdinal ? {currentProblemOrdinal} : {})
  });
}

export async function updateSingleClassDataDoc(portal: string|undefined, demo: string|undefined, unit: string,
    contextId: string, logger: Logger) {
  const classData = await getClassDocumentData(portal, demo, unit, logger, contextId);
  const data = classData[contextId];
  if (!data) {
    // Empty-class guard: write an empty placeholder so the client shows
    // "No teacher/student summary available" instead of spinning on
    // "Generating summary...". teacherSummary/studentSummary stay undefined;
    // the client's ?? fallback handles rendering.
    logger.info(`No documents found for ${unit} ${contextId}; writing empty placeholder class data doc`);
    await getClassDataDoc(portal, demo, unit, contextId).set({
      userCount: 0,
      documentCount: 0,
      teacherContent: "",
      studentContent: "",
      summary: null,
      summaryCreatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }
  await updateClassDataDoc(portal, demo, unit, contextId, data, logger);
}

async function updateClassDataDocsForRealm(portal: string|undefined, demo: string|undefined, logger: Logger) {
  for (const unit of units) {
    const classData = await getClassDocumentData(portal, demo, unit, logger);
    for (const contextId in classData) {
      const data = classData[contextId];
      if (await dataDocNeedsUpdate(portal, demo, unit, contextId, data)) {
        await updateClassDataDoc(portal, demo, unit, contextId, data, logger);
      } else {
        logger.info(`Class data doc for ${unit} ${contextId} already up to date`);
      }
    }
  }
}

export async function updateClassDataDocs({ logger }: { logger: Logger }) {
  for (const demo of demos) {
    await updateClassDataDocsForRealm(undefined, demo, logger);
  }
  for (const portal of portals) {
    await updateClassDataDocsForRealm(portal, undefined, logger);
  }
}
