import firebase from "firebase/app";
import { useCallback } from "react";
import { useMutation, UseMutationOptions } from "react-query";
import { IDocumentMetadata, IPostCommentParams, IUserContext } from "../../functions/src/shared-types";
import { CommentDocument } from "../lib/firestore-schema";
import { useCollectionOrderedRealTimeQuery } from "./firestore-hooks";
import { useUserContext } from "./use-user-context";

/*
 * postDocumentComment
 *
 * Uses firebase function under the hood.
 */
interface IPostDocumentCommentParams {
  userContext: IUserContext;
  document: IDocumentMetadata;
  tileId?: string;
  comment: string;
}
const postDocumentComment = ({ userContext, document, tileId, comment }: IPostDocumentCommentParams) => {
  const params: IPostCommentParams = { context: userContext, document, comment: { tileId, content: comment } };
  const postDocumentComment_v1 = firebase.functions().httpsCallable("postDocumentComment_v1");
  return postDocumentComment_v1(params);
};

/*
 * usePostDocumentComment
 *
 * Implemented via React Query's useMutation hook.
 */
interface IPostCommentInfo {
  document: IDocumentMetadata;
  comment: string;
  tileId?: string;
}
type PostDocumentCommentUseMutationOptions =
      UseMutationOptions<firebase.functions.HttpsCallableResult, unknown, IPostCommentInfo>;
export const usePostDocumentComment = (options?: PostDocumentCommentUseMutationOptions) => {
  const userContext = useUserContext();
  const postComment = useCallback((postCommentInfo: IPostCommentInfo) => {
    return postDocumentComment({ userContext, ...postCommentInfo });
  }, [userContext]);
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
    return { createdAt: createdAt.toDate(), ...others } as CommentDocument;
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
  return useCollectionOrderedRealTimeQuery(
          `documents/${documentKey}/comments`, {
            converter: commentConverter,
            orderBy: "createdAt"
          });
};
