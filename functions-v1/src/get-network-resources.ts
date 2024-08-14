import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {
  IGetNetworkResourcesUnionParams, INetworkResourceClassResponse, INetworkResourceOfferingResponse,
  INetworkResourceTeacherClassResponse, INetworkResourceTeacherOfferingResponse, isWarmUpParams
} from "./shared";
import { validateUserContext } from "./user-context";

// update this when deploying updates to this function
const version = "1.1.2";

export async function getNetworkResources(
                        params?: IGetNetworkResourcesUnionParams,
                        callableContext?: functions.https.CallableContext) {
  if (isWarmUpParams(params)) return { version };

  const { context, problem } = params || {};
  const { appMode, classHash: userContextId, network } = context || {};
  const { isValid, uid, classPath: userClassPath, firestoreRoot } = validateUserContext(context, callableContext?.auth);
  if (!context || !isValid || !userContextId || !network || !uid) {
    throw new functions.https.HttpsError("failed-precondition", "The provided user context is not valid.");
  };

  // validate that authenticated users are in the network they claim to be in
  if (appMode === "authed") {
    const userDocResult = await admin.firestore().doc(`/${firestoreRoot}/users/${uid}`).get();
    if (!userDocResult.exists || (userDocResult.data()?.network !== network)) {
      throw new functions.https.HttpsError("failed-precondition", "The provided user network is not valid.");
    }
  }

  // query for set of offerings matching the requested problem
  const classOfferings: Record<string, string[]> = {};
  const offerings = await admin.firestore()
                            .collection(`/${firestoreRoot}/offerings`)
                            .where("network", "==", network)
                            .where("problemPath", "==", problem)
                            .get();
  // determine the set of classes containing those problems
  offerings.forEach(offering => {
    const { context_id, id } = offering.exists
                                ? offering.data()
                                // https://github.com/Microsoft/TypeScript/issues/26235#issuecomment-452955161
                                : {} as Partial<NonNullable<{ context_id: string, id: string }>>;
    if (!classOfferings[context_id]) {
      classOfferings[context_id] = [];
    }
    classOfferings[context_id].push(id);
  });
  // map to array of classes with subarray of offerings
  const classes = Object.keys(classOfferings).map(context_id => {
    return { context_id, resource_link_ids: classOfferings[context_id] };
  });

  // returns the first document in the map of documents
  // used to restrict problem/planning documents to singletons
  // only the first document is considered client-side as well
  function firstDocMap(documentMap?: Record<string, any>) {
    const firstKey = documentMap && Object.keys(documentMap)[0];
    return firstKey ? { [firstKey]: documentMap[firstKey] } : documentMap;
  }

  // return a promise for each class
  const classPromises: Promise<INetworkResourceClassResponse>[] = [];
  classes?.forEach(async ({ context_id, resource_link_ids }) => {
    const classPath = userClassPath.replace(userContextId, context_id);
    classPromises.push(new Promise(async (resolveClass, rejectClass) => {
      try {
        const classDoc = await admin.firestore().doc(`/${firestoreRoot}/classes/${network}_${context_id}`).get();
        const isValidClassNetwork = classDoc.exists && (classDoc.data()?.network === network);
        // retrieve metadata for class-wide publications
        let learningLogPublications;
        let personalPublications;
        if (isValidClassNetwork) {
          try {
            const [learningLogPublicationsSnap, personalPublicationsSnap] = await Promise.all([
              admin.database().ref(`${classPath}/publications`).get(),        // published learning logs
              admin.database().ref(`${classPath}/personalPublications`).get() // published personal documents
            ]);
            learningLogPublications = learningLogPublicationsSnap.val() || undefined;
            personalPublications = personalPublicationsSnap.val() || undefined;
          }
          catch(e) {
            // ignore failing publications for now so we can return the rest of the results
          }
        }
        // return a promise for each offering within the class
        const offeringPromises: Promise<INetworkResourceOfferingResponse>[] = [];
        resource_link_ids.forEach(resource_link_id => {
          const offeringRoot = `${classPath}/offerings/${resource_link_id}`;
          offeringPromises.push(new Promise(async (resolveOffering, rejectOffering) => {
            if (isValidClassNetwork) {
              // return promises for individual metadata requests
              try {
                // retrieve metadata for published problem documents
                const problemPublicationsSnap = await admin.database().ref(`${offeringRoot}/publications`).get();
                const problemPublications = problemPublicationsSnap.val() || undefined;
                // teacher problem/planning documents are returned under each teacher
                type TeacherOfferingPromise = Promise<INetworkResourceTeacherOfferingResponse>;
                const teachers: TeacherOfferingPromise[] = classDoc.data()?.teachers.map(async (teacherId: string) => {
                  return new Promise<INetworkResourceTeacherOfferingResponse>(async (resolve, reject) => {
                    const offeringUserRoot = `${offeringRoot}/users/${teacherId}`;
                    const [problemDocumentsSnap, planningDocumentsSnap] = await Promise.all([
                      admin.database().ref(`${offeringUserRoot}/documents`).get(),
                      admin.database().ref(`${offeringUserRoot}/planning`).get()
                    ]);
                    const problemDocuments = firstDocMap(problemDocumentsSnap.val()) || undefined;
                    const planningDocuments = firstDocMap(planningDocumentsSnap.val()) || undefined;
                    resolve({ uid: teacherId, problemDocuments, planningDocuments });
                  })
                }) || [];
                resolveOffering({
                  resource_link_id, problemPublications, teachers: await Promise.all(teachers)
                });
              }
              catch(e) {
                // on error we just don't return any resources for the offering
                resolveOffering({ resource_link_id });
              }
            }
            else {
              // on error we just don't return any resources for the offering
              resolveOffering({ resource_link_id });
            }
          }));
        });
        const classDocData = classDoc?.exists ? classDoc.data() : undefined;
        const { id, name, uri, teacher, teachers: _teachers } = classDocData || {};
        type TeacherClassPromise = Promise<INetworkResourceTeacherClassResponse>;
        const teacherClassPromises: TeacherClassPromise[] = _teachers?.map((teacherId: string) => {
          return new Promise<INetworkResourceTeacherClassResponse>(async (resolve, reject) => {
            try {
              const classUserRoot = `${classPath}/users/${teacherId}`;
              const [personalDocumentsSnap, learningLogsSnap] = await Promise.all([
                admin.database().ref(`${classUserRoot}/personalDocs`).get(),
                admin.database().ref(`${classUserRoot}/learningLogs`).get()
              ]);
              const personalDocuments = personalDocumentsSnap.val() || undefined;
              const learningLogs = learningLogsSnap.val() || undefined;
              resolve({ uid: teacherId, personalDocuments, learningLogs });
            }
            catch(e) {
              resolve({ uid: teacherId });
            }
          });
        }) || [];
        const teacherResponses = await Promise.all(teacherClassPromises);
        const classData = classDocData ? { id, name, uri, teacher, teachers: teacherResponses } : undefined;

        const resources = await Promise.all(offeringPromises);
        resolveClass({ context_id, ...classData, personalPublications, learningLogPublications, resources })
      }
      catch(e) {
        // on error we just don't return any resources for the class
        resolveClass({ context_id, resources: [] });
      }
    }));
  });

  const response = await Promise.all(classPromises);
  return { version, response };
};
