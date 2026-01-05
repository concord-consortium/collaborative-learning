import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { documentSummarizer } from "./ai-summarizer/ai-summarizer";

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
  documents: Set<{ uid: string, key: string, isTeacherDocument: boolean }>;
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
    .select("context_id", "uid", "key");
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
      record.documents.add({ uid, key, isTeacherDocument });
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
    uid: string, key: string): Promise<{ content: any | null, error: string | null }> {
  try {
    const documentPath = `${firebaseBasePath(portal, demo)}/classes/${contextId}/users/${uid}/documents/${key}`;
    const documentSnapshot = await getDatabase().ref(documentPath).once("value");
    const documentData = documentSnapshot.val();

    if (!documentData) {
      return({ content: null, error: `No document found at path: ${documentPath}` });
    }

    let parsedContent: any = null;
    if (documentData.content) {
      try {
        parsedContent = JSON.parse(documentData.content);
        return({ content: parsedContent, error: null });
      } catch (parseError) {
        return({ content: null, error: `Failed to parse document content: ${parseError}` });
      }
    } else {
      return({ content: null, error: "Document has no content field" });
    }

  } catch (error) {
    return({ content: null, error: `Error retrieving document from Firebase: ${error}` });
  }
}

async function retrieveAndSummarizeDocument(portal: string|undefined, demo: string|undefined, contextId: string,
    uid: string, key: string, logger: Logger): Promise<string> {
  const document = await retrieveDocumentFromFirebase(portal, demo, contextId, uid, key);
  if (document.error) {
    logger.info(`Error retrieving document (${contextId}/${uid}/${key}) from Firebase: ${document.error}`);
  }
  return documentSummarizer(document.content, { includeModel: false, minimal: true });
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
  const teacherSummaries = await Promise.all(teacherDocs.map(async ({uid, key}) =>  {
    return await retrieveAndSummarizeDocument(portal, demo, contextId, uid, key, logger);
  }));
  const studentSummaries = await Promise.all(studentDocs.map(async ({uid, key}) =>  {
    return await retrieveAndSummarizeDocument(portal, demo, contextId, uid, key, logger);
  }));
  const teacherContent = teacherSummaries.join("\n\n");
  const studentContent = studentSummaries.join("\n\n");

  return getClassDataDoc(portal, demo, unit, contextId).set({
    lastEditedAt: data.lastEditedAt,
    userCount: data.userCount,
    documentCount: data.documentCount,
    teacherContent,
    studentContent,
    summary: null
  });
}

export async function updateSingleClassDataDoc(portal: string|undefined, demo: string|undefined, unit: string,
    contextId: string, logger: Logger) {
  const classData = await getClassDocumentData(portal, demo, unit, logger, contextId);
  const data = classData[contextId];
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
