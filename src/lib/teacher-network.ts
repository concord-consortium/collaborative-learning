import firebase from "firebase/app";
import { Optional } from "utility-types";
import { ClassModelType } from "../models/stores/class";
import { UserModelType } from "../models/stores/user";
import { arraysEqualIgnoringOrder } from "../utilities/js-utils";
import { Firestore, isFirestorePermissionsError } from "./firestore";
import { ClassDocument, OfferingDocument } from "./firestore-schema";
import { IPortalClassInfo } from "./portal-types";

export type ClassWithoutTeachers = Optional<ClassDocument, "teachers">;
export type OfferingWithoutTeachers = Optional<OfferingDocument, "teachers">;

let classTeachersPromises: Record<string, Promise<string[] | undefined>> = {};

// primarily for testing
export function clearTeachersPromises() {
  classTeachersPromises = {};
}

// returns a promise that resolves to the list of teacher user ids (or undefined on error)
// uses the classTeachersPromises map to guarantee that each class is only requested once
function getClassTeachers(classUri: string, rawPortalJWT: string) {
  // return the existing promise if we've already created one
  let promise = classTeachersPromises[classUri];
  if (!promise) {
    promise = classTeachersPromises[classUri] = new Promise((resolve, reject) => {
      const fetchOptions: RequestInit = { headers: { Authorization: `Bearer/JWT ${rawPortalJWT}` } };
      fetch(classUri, fetchOptions)
        .then(response => {
          if (response.ok) {
            response.json().then((portalClass: IPortalClassInfo) => {
              resolve(portalClass.teachers.map(t => `${t.user_id}`));
            });
          }
          else {
            resolve(undefined);
          }
        })
        .catch(error => {
          resolve(undefined);
        });
    });
  }
  return promise;
}

// converts "msa", "1.4" to "msa/1/4"
export function getProblemPath(unit: string, problem: string) {
  return [unit, ...problem.split(".")].join("/");
}

// synchronize the current teacher's classes and offerings to firestore
export function syncTeacherClassesAndOfferings(
    firestore: Firestore, user: UserModelType, classModel: ClassModelType, rawPortalJWT?: string) {
  const { network } = user;
  const promises: Promise<any>[] = [];

  // map portal offerings to classes
  const userClasses: Record<string, ClassWithoutTeachers> = {};
  user.portalClassOfferings.forEach(offering => {
    const { classId: id, classHash: context_id, className: name, classUrl: uri, teacher } = offering;
    if (!userClasses[context_id]) {
      userClasses[context_id] = { id, context_id, name, uri, teacher, network };
    }
  });

  // If the current class has not been set up (eg demo/qa site), add it with some stubbed-in fields.
  if (!userClasses[classModel.classHash]) {
    userClasses[classModel.classHash] = {
      id: classModel.classHash,
      context_id: classModel.classHash,
      name: classModel.name,
      teacher: user.id,
      uri: "",
      network
    };
  }

  // synchronize the classes
  Object.keys(userClasses).forEach(async context_id => {
    promises.push(syncClass(firestore, rawPortalJWT, userClasses[context_id], user, network));
  });

  if (network && rawPortalJWT) {
    // synchronize the offerings
    user.portalClassOfferings.forEach(async offering => {
      const {
        offeringId: id, activityTitle: name, activityUrl: uri, classHash: context_id, classUrl,
        unitCode: unit, problemOrdinal: problem
      } = offering;
      const problemPath = getProblemPath(unit, problem);
      const fsOffering: OfferingWithoutTeachers = { id, name, uri, context_id, unit, problem, problemPath, network };
      promises.push(syncOffering(firestore, rawPortalJWT, classUrl, fsOffering));
    });
  }
  return Promise.all(promises);
}

async function createOrUpdateClassDoc(
    firestore: Firestore, docPath: string, aClass: ClassDocument, addNetwork?: string) {
  const docRef = firestore.doc(docPath);
  return firestore.runTransaction(async (transaction) => {
    // Security rules can depend on the contents of the document, so we could get a permissions
    // error when trying to read, but still be able to write a document into this location.
    let current;
    try {
      current = await docRef.get();
    } catch (e) {
      // Ignore permissions error, but quit on any other problem
      if (!isFirestorePermissionsError(e)) {
        console.warn("Error retrieving class document:", e);
        return;
      }
    }
    if (current && current.exists) {
      // Update existing doc
      const data = current.data() as ClassDocument;
      if (!arraysEqualIgnoringOrder(aClass.teachers, data.teachers)) {
        console.log("updating teacher array:", data.teachers, aClass.teachers);
        await docRef.update({ teachers: aClass.teachers });
      }
      if (addNetwork && !data.network?.includes(addNetwork)) {
        console.log("updating networks array:", data.network, addNetwork);
        await docRef.update({ network: firebase.firestore.FieldValue.arrayUnion(addNetwork) });
      }
    } else {
      // Create the document.
      console.log("new doc:", aClass, addNetwork);
      if (addNetwork) {
        await docRef.set({ ...aClass, network: addNetwork, networks: [addNetwork] });
      } else {
        await docRef.set(aClass);
      }
    }
  });
}

export async function syncClass(firestore: Firestore, rawPortalJWT: string|undefined,
    aClass: ClassWithoutTeachers, user: UserModelType, addNetwork?: string) {
  const { uri, context_id } = aClass;
  const promises: Promise<any>[] = [];
  if (context_id) {
    // Get list of teachers from the portal, if we have a portal login.
    // Otherwise, default to just the current teacher (for demo/qa)
    const teachers = (uri && rawPortalJWT) ? await getClassTeachers(uri, rawPortalJWT) : [user.id];
    if (!teachers) return;
    const classWithTeachers = { ...aClass, teachers };
    if (addNetwork) {
      classWithTeachers.network = addNetwork;
    }
    // Firestore will not accept 'undefined' values
    if (classWithTeachers.network === undefined) {
      delete classWithTeachers.network;
    }

    // Old location of the class document
    if (aClass.network) {
      console.log('attempting to set old class doc:', `classes/${aClass.network}_${context_id}`,
        classWithTeachers, addNetwork);
      promises.push(createOrUpdateClassDoc(firestore, `classes/${aClass.network}_${context_id}`,
        classWithTeachers, addNetwork));
    }
    // New location of the class document
    console.log('attempting to set new class doc:', `classes/${context_id}`, classWithTeachers, addNetwork);
    promises.push(createOrUpdateClassDoc(firestore, `classes/${context_id}`, classWithTeachers, addNetwork));
  }
  return Promise.all(promises);
}

export async function syncOffering(
  firestore: Firestore, rawPortalJWT: string, classUrl: string, offering: OfferingWithoutTeachers)
{
  const { network, id } = offering;
  if (classUrl && network && rawPortalJWT) {
    return firestore.guaranteeDocument(`offerings/${network}_${id}`, async () => {
      const teachers = await getClassTeachers(classUrl, rawPortalJWT);
      if (teachers) {
        offering.teachers = teachers;
        return offering;
      }
    });
  }
}

export function getNetworkClassesThatAssignedProblem(firestore: Firestore, network: string, problemPath: string) {
  return firestore
          .collection("offerings")
          .where("network", "==", network)
          .where("problemPath", "==", problemPath)
          .get();
}
