import {FirestoreEvent, onDocumentWritten} from "firebase-functions/v2/firestore";
import {Change, DocumentSnapshot} from "firebase-functions/lib/v2/providers/firestore";
import * as admin from "firebase-admin";

/*
 * onDocumentTagged
 * Listens for changes to comments and updates the strategies array in the commented-on document's metadata.
*/
export const onDocumentTagged = onDocumentWritten(
  "{root}/{space}/documents/{documentId}/comments/{commentId}",
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined>) => {
    if (!event.data) return;

    const {root, space, documentId} = event.params;
    const firestore = admin.firestore();
    const docKey = await firestore.collection(`${root}/${space}/documents`).doc(documentId).get().then((doc) => {
      return doc.data()?.key;
    });
    if (!docKey) return;

    const collectionPath = `${root}/${space}/documents`;
    const documentCollection = admin.firestore().collection(collectionPath);
    const documentSnapshots = await documentCollection.where("key", "==", docKey).get();
    const strategies: string[] = [];

    // Get all tags from all comments on the document and build an array of unique strategy values from them.
    for (const _documentSnapshot of documentSnapshots.docs) {
      const commentsUrl = `${_documentSnapshot.ref.path}/comments`;
      const commentCollection = admin.firestore().collection(commentsUrl);
      const commentSnapshots = await commentCollection.get();

      for (const _commentSnapshot of commentSnapshots.docs) {
        const commentTags = _commentSnapshot.data()?.tags ?? [];

        if (commentTags != null && !Array.isArray(commentTags)) {
          console.warn("Found invalid comment tags", _commentSnapshot.ref.path, commentTags);
          continue;
        }

        commentTags.forEach((tag: string) => {
          if (tag && !strategies.includes(tag)) {
            strategies.push(tag);
          }
        });
      }
    }

    const metadataQuery = documentCollection.where("key", "==", docKey);
    const querySnapshot = await metadataQuery.get();

    for (const doc of querySnapshot.docs) {
      const docRef = doc.ref;
      await docRef.update({strategies: [...strategies]});
    }
  });
