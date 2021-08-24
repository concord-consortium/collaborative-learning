import { useCallback } from "react";

/*
 * usePostDocumentComment [STUB]
 *
 * Implemented via React Query's useMutation hook.
 */
interface IPostCommentInfo {
  document: any;
  comment: string;
  tileId?: string;
}
export const usePostDocumentComment = () => {
  const postComment = useCallback((postCommentInfo: IPostCommentInfo) => {
    console.log("Posting comment:", JSON.stringify(postCommentInfo));
  }, []);
  return { mutate: (postCommentInfo: IPostCommentInfo) => postComment(postCommentInfo) };
};

/*
 * useDocumentComments [STUB]
 *
 * Sets up a Firestore real-time query which returns the comments associated with the
 * specified document. The returned results are managed by React Query, e.g. caching
 * and reuse if multiple clients request the same comments.
 */
export const useDocumentComments = (documentKey: string) => {
  return {
    isLoading: false,
    isError: false,
    data: {
      docs: [
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 1"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 2"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 3"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 4"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 5"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 6"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 7"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 8"}) },
      ]
    },
    error: undefined
  };
};
