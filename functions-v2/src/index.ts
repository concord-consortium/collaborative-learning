import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

admin.initializeApp();

export const updateClassDocNetworksOnUserChange =
  onDocumentWritten("{root}/{space}/users/{userId}", async (event) => {
    const {root, space, userId} = event.params;

    const classesResult = await admin.firestore()
      .collection(`${root}/${space}/classes`)
      .where("teachers", "array-contains", userId)
      .get();

    // For every class of this teacher update the networks.
    // We could do something more efficient in the case where a network was
    // added. That can be figured out by looking at the event.data.before and
    // event.data.after documents.
    // However to keep the code more simple we just always do the scan
    // of classes and teachers. This is required when a network is deleted
    // because we need to figure out if another teacher in the class still has
    // the deleted network.

    // To optimize this we collect all of the teachers we care about
    // and make one request for them instead of requesting the teachers for each
    // class separately.

    const teacherIdSet = new Set<string>();
    classesResult.forEach((classDoc) => {
      const {teachers} = classDoc.data() as {teachers: string[]};
      if (!Array.isArray(teachers)) return;
      teachers.forEach((id) => teacherIdSet.add(id));
    });

    const teacherIds = [...teacherIdSet];

    const teacherNetworks: Record<string, string[]|undefined> = {};

    // Need to use batching incase the number of teacherIds is larger than 30
    const batchSize = 30;
    for (let i = 0; i < teacherIds.length; i += batchSize) {
      const batch = teacherIds.slice(i, i + batchSize);
      const teachersResult = await admin.firestore()
        .collection(`${root}/${space}/users`)
        .where("uid", "in", batch)
        .get();

      teachersResult.forEach((teacherDoc) => {
        const teacherData = teacherDoc.data();
        teacherNetworks[teacherData.uid] = teacherData.networks;
      });
    }

    const classUpdatePromises: Promise<unknown>[] = [];
    classesResult.forEach((classDoc) => {
      // Update each class with the networks of each teacher in the class
      const {teachers} = classDoc.data() as {teachers: string[]};
      if (!Array.isArray(teachers)) return;
      const classNetworks = new Set<string>();
      teachers.forEach((teacher) => {
        const networks = teacherNetworks[teacher];
        if (!networks) return;
        networks.forEach((network) => classNetworks.add(network));
      });
      const orderedNetworks = [...classNetworks].sort();
      classUpdatePromises.push(
        classDoc.ref.update({networks: orderedNetworks})
      );
    });

    await Promise.all(classUpdatePromises);

    logger.info("User updated", event.document);
  });
