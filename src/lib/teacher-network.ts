import { Optional } from "utility-types";
import { UserModelType } from "../models/stores/user";
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
export function syncTeacherClassesAndOfferings(firestore: Firestore, user: UserModelType, rawPortalJWT: string) {
  const { network } = user;
  if (!network) return [];

  const promises: Promise<void>[] = [];

  // map portal offerings to classes
  const userClasses: Record<string, ClassWithoutTeachers> = {};
  user.portalClassOfferings.forEach(offering => {
    const { classId: id, classHash: context_id, className: name, classUrl: uri, teacher } = offering;
    if (!userClasses[context_id]) {
      userClasses[context_id] = { id, context_id, name, uri, teacher, network };
    }
  });

  // synchronize the classes
  Object.keys(userClasses).forEach(async classHash => {
    promises.push(syncClass(firestore, rawPortalJWT, userClasses[classHash]));
  });

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

  return promises;
}

export async function syncClass(firestore: Firestore, rawPortalJWT: string, aClass: ClassWithoutTeachers) {
  const { uri, context_id, network } = aClass;
  if (uri && context_id && network && rawPortalJWT) {
    const classDoc = firestore.doc(`classes/${network}_${context_id}`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const fsClass = await classDoc.get();
      // class already exists in firestore; could sync contents but we'll skip for now
    }
    catch(e) {
      if (isFirestorePermissionsError(e)) {
        const teachers = await getClassTeachers(uri, rawPortalJWT);
        if (teachers) {
          aClass.teachers = teachers;
          classDoc.set(aClass);
        }
      }
    }
  }
}

export async function syncOffering(
  firestore: Firestore, rawPortalJWT: string, classUrl: string, offering: OfferingWithoutTeachers)
{
  const { context_id, network } = offering;
  if (classUrl && network && rawPortalJWT) {
    const offeringDoc = firestore.doc(`offerings/${network}_${context_id}`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const fsOffering = await offeringDoc.get();
      // offering already exists in firestore; could sync contents but we'll skip for now
    }
    catch(e) {
      if (isFirestorePermissionsError(e)) {
        const teachers = await getClassTeachers(classUrl, rawPortalJWT);
        if (teachers) {
          offering.teachers = teachers;
          offeringDoc.set(offering);
        }
      }
    }
  }
}
