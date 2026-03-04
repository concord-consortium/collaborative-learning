import firebase from "firebase/app";
import { useCallback } from "react";
import { RatingValue } from "../../shared/shared";
import { useFirestore } from "./firestore-hooks";
import { useUserContext } from "./use-user-context";

export function useUpdateCommentRating() {
  const [firestore] = useFirestore();
  const { uid } = useUserContext();

  return useCallback(
    async (commentPath: string, value: RatingValue | undefined) => {
      if (!uid) return;
      const docRef = firestore.doc(commentPath);
      if (value) {
        await docRef.update({ [`ratings.${uid}`]: value });
      } else {
        await docRef.update({ [`ratings.${uid}`]: firebase.firestore.FieldValue.delete() });
      }
    },
    [firestore, uid]
  );
}
