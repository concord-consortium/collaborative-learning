import { Optional } from "utility-types";
import { UserModelType } from "../models/stores/user";
import { arraysEqualIgnoringOrder } from "../utilities/js-utils";
import { Firestore } from "./firestore";
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
export function syncTeacherClassesAndOfferings(firestore: Firestore, user: UserModelType, rawPortalJWT: string) {
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

  // synchronize the classes
  Object.keys(userClasses).forEach(async context_id => {
    promises.push(syncClass(firestore, rawPortalJWT, userClasses[context_id]));
  });

  if (network) {
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

async function createOrUpdateClassDoc(firestore: Firestore, docPath: string, aClass: ClassDocument):
      Promise<void|ClassDocument> {
  return firestore.guaranteeDocument(docPath,
     async () => { return aClass; },
     (content) => { return !content || !arraysEqualIgnoringOrder(aClass.teachers, content.teachers); }
  );
}

export async function syncClass(firestore: Firestore, rawPortalJWT: string, aClass: ClassWithoutTeachers) {
  const { uri, context_id, network } = aClass;
  const promises: Promise<void|ClassDocument>[] = [];
  if (uri && context_id && rawPortalJWT) {
    const teachers = await getClassTeachers(uri, rawPortalJWT);
    if (!teachers) return;
    const classWithTeachers = { ...aClass, teachers };
    // Old location of the class document
    if (network) {
      promises.push(createOrUpdateClassDoc(firestore, `classes/${network}_${context_id}`, classWithTeachers));
    }
    // New location of the class document
    promises.push(createOrUpdateClassDoc(firestore, `classes/${context_id}`, classWithTeachers));
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
