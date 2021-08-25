import firebase from "firebase/app";
import { useCallback } from "react";
import { useMutation, UseMutationOptions } from "react-query";
import { IPostDocumentCommentParams } from "../../functions/src/shared-types";
import { CommentDocument } from "../lib/firestore-schema";
import { useCollectionOrderedRealTimeQuery } from "./firestore-hooks";
import { useFirebaseFunction } from "./use-firebase-function";
import { useNetworkDocumentKey } from "./use-stores";
import { useUserContext } from "./use-user-context";

/*
 * usePostDocumentComment
 *
 * Implemented via React Query's useMutation hook.
 */
type IPostDocumentCommentClientParams = Omit<IPostDocumentCommentParams, "context">;
type PostDocumentCommentUseMutationOptions =
      UseMutationOptions<firebase.functions.HttpsCallableResult, unknown, IPostDocumentCommentClientParams>;

export const usePostDocumentComment = (options?: PostDocumentCommentUseMutationOptions) => {
  const postDocumentComment = useFirebaseFunction<IPostDocumentCommentParams>("postDocumentComment_v1");
  const context = useUserContext();
  const postComment = useCallback((clientParams: IPostDocumentCommentClientParams) => {
    return postDocumentComment({ context, ...clientParams });
  }, [context, postDocumentComment]);
  return useMutation(postComment, options);
};

const commentConverter = {
  toFirestore: (comment: CommentDocument) => {
    const { createdAt: createdAtDate, ...others } = comment;
    // Convert JS Date (if provided) to Firestore Timestamp; we generally let Firestore provide the
    // timestamp, so client-provided timestamps are unlikely to occur, but we handle them just in case.
    const createdAt = createdAtDate ? firebase.firestore.Timestamp.fromDate(createdAtDate) : undefined;
    return { createdAt, ...others };
  },
  fromFirestore: (doc: firebase.firestore.QueryDocumentSnapshot): CommentDocument => {
    const { createdAt, ...others } = doc.data();
    // Convert Firestore Timestamp to JavaScript Date
    return { createdAt: createdAt?.toDate(), ...others } as CommentDocument;
  }
};

/*
 * useDocumentComments
 *
 * Sets up a Firestore real-time query which returns the comments associated with the
 * specified document. The returned results are managed by React Query, e.g. caching
 * and reuse if multiple clients request the same comments.
 */
export const useDocumentComments = (documentKey: string) => {
  const docKey = useNetworkDocumentKey(documentKey);
  const path = documentKey ? `documents/${docKey}/comments` : "";
  const converter = commentConverter;
  return useCollectionOrderedRealTimeQuery(path, { converter, orderBy: "createdAt" });
};

/*
 * useUnreadDocumentComments
 *
 * Shares the same Firestore real-time listener as the previous hook but filters the results
 * to return unread messages. We don't have an implementation for this yet, but this hook
 * serves as a placeholder. Eventually, we will need to figure out whether this will be
 * based on a single timestamp, or a separate timestamp for each thread, or flags for each
 * message indicated which have been read, etc.
 */
export const useUnreadDocumentComments = (documentKey: string) => {
  // TODO: figure this out; for now it's just a comment counter
  return useDocumentComments(documentKey);
};
