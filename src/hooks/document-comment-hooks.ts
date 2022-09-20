import firebase from "firebase/app";
import { useCallback } from "react";
import { useMutation, UseMutationOptions, useQuery, useQueryClient } from "react-query";
import {
  ICommentableDocumentParams, ICurriculumMetadata, IDocumentMetadata, IPostDocumentCommentParams,
  isCurriculumMetadata, isDocumentMetadata, isSectionPath
} from "../../functions/src/shared";
import { CommentDocument, CurriculumDocument, DocumentDocument } from "../lib/firestore-schema";
import { useCollectionOrderedRealTimeQuery, useFirestore, WithId } from "./firestore-hooks";
import { useFirebaseFunction } from "./use-firebase-function";
import { useDocumentOrCurriculumMetadata, useNetworkDocumentKey } from "./use-stores";
import { useUserContext } from "./use-user-context";
import { uniqueId } from "../utilities/js-utils";
import { HistoryEntrySnapshot } from "../models/history/history";

// documentKeyOrSectionPath => queryKey
const commentsQueryKeyMap: Record<string, string> = {};

/**
 * useCommentableDocumentPath
 *
 * For now, parses the specified key to see if it looks like a curriculum
 * document path, otherwise assumes it's a document key.
 *
 * @param documentKeyOrSectionPath
 * @param userId optional param that overrides the current user and the network.
 * This is used so teachers can find the path of student documents.
 *
 */
export const useCommentableDocumentPath = (documentKeyOrSectionPath: string, userId?: string) => {
  const docKey = useNetworkDocumentKey(documentKeyOrSectionPath, userId);
  if (!documentKeyOrSectionPath) return documentKeyOrSectionPath;
  // if it looks like a section path, assume it's a curriculum document reference
  return isSectionPath(documentKeyOrSectionPath)
          ? `curriculum/${docKey}`
          : `documents/${docKey}`;
};

/*
 * useCommentsCollectionPath
 *
 * For now, parses the specified key to see if it looks like a curriculum document path,
 * otherwise assumes it's a document key.
 */
export const useCommentsCollectionPath = (documentKeyOrSectionPath: string) => {
  const docPath = useCommentableDocumentPath(documentKeyOrSectionPath);
  if (!documentKeyOrSectionPath) return documentKeyOrSectionPath;
  return `${docPath}/comments`;
};

export const getCommentsQueryKeyFromMetadata = (metadata: IDocumentMetadata | ICurriculumMetadata) => {
  const documentKey = isDocumentMetadata(metadata) ? metadata.key : undefined;
  const curriculumKey = isCurriculumMetadata(metadata) ? `${metadata.path}/${metadata.section}` : undefined;
  const curriculumOrDocumentKey = curriculumKey || documentKey;
  return curriculumOrDocumentKey && commentsQueryKeyMap[curriculumOrDocumentKey];
};

/*
 * useValidateCommentableDocument
 *
 * Implemented via React Query's useMutation hook.
 */
type IValidateDocumentClientParams = Omit<ICommentableDocumentParams, "context">;
type ValidateDocumentUseMutationOptions =
      UseMutationOptions<firebase.functions.HttpsCallableResult, unknown, IValidateDocumentClientParams>;

export const useValidateCommentableDocument = (options?: ValidateDocumentUseMutationOptions) => {
  const validateCommentableDocument = useFirebaseFunction<ICommentableDocumentParams>("validateCommentableDocument_v1");
  const context = useUserContext();
  const validateDocument = useCallback((clientParams: IValidateDocumentClientParams) => {
    return validateCommentableDocument({ context, ...clientParams });
  }, [context, validateCommentableDocument]);
  return useMutation(validateDocument, options);
};

/**
 * useCommentableDocument
 *
 * Checks whether the specified document exists and creates it if not.
 * Implemented via React Query's useQuery hook.
 * 
 * @param documentKeyOrSectionPath
 * @param userId optional param that overrides the current user and the network.
 * This is used so teachers can find the path of student documents.
 */
export type DocumentQueryType = CurriculumDocument | DocumentDocument | undefined;
export const useCommentableDocument = (documentKeyOrSectionPath?: string, userId?: string) => {
  const [firestore] = useFirestore();
  const documentPath = useCommentableDocumentPath(documentKeyOrSectionPath || "", userId);
  const documentMetadata = useDocumentOrCurriculumMetadata(documentKeyOrSectionPath);
  const validateDocumentMutation = useValidateCommentableDocument();
  return useQuery(documentPath, () => new Promise<DocumentQueryType>((resolve, reject) => {
    const documentRef = firestore.doc(documentPath);
    const unsubscribeDocListener = documentRef?.onSnapshot({
      next: docSnapshot => {
        unsubscribeDocListener?.();
        resolve(docSnapshot.data() as DocumentQueryType);
      },
      error: readError => {
        unsubscribeDocListener?.();
        // an error presumably means that the document doesn't exist yet, so we create it
        // WRONG!
        //
        // FIXME-HISTORY: this never really called. The onSnapshot will just sit there waiting for the 
        // for the document to show up if it doesn't exist.
        // The better approach for this is to use:
        //       const documentRef = firestore.doc(documentPath);
        // documentRef.get()
        //   .then(docSnapshot => {
        //     if (docSnapshot.exists) {
        //        ...
        // However, this is actually not necessary because the postDocument will create the
        // Document in firestore if it doesn't exist.
        // `useCommentableDocument` is only called by `useDocumentComments`, so it is OK for this
        // to wait or the document to show up. If there are comments there will be a document.

        validateDocumentMutation.mutate({ document: documentMetadata! }, {  // ! since query won't run otherwise
          onSuccess: result => resolve(result.data),
          onError: createError => { throw createError; }
        });
      }
    });
  }), { // useQuery options
    enabled: !!documentPath && !!documentMetadata,  // don't run the query if we don't have prerequisites
    staleTime: Infinity,                            // never need to rerun the query once it succeeds
    cacheTime: 60 * 60 * 1000                       // keep it in cache for 60 minutes
  });
};

/*
 * usePostDocumentComment
 *
 * Implemented via React Query's useMutation hook.
 */
type IPostDocumentCommentClientParams = Omit<IPostDocumentCommentParams, "context">;
type PostDocumentCommentUseMutationOptions =
      UseMutationOptions<firebase.functions.HttpsCallableResult, unknown, IPostDocumentCommentClientParams>;

export const usePostDocumentComment = (options?: PostDocumentCommentUseMutationOptions) => {
  const queryClient = useQueryClient();
  const postDocumentComment = useFirebaseFunction<IPostDocumentCommentParams>("postDocumentComment_v1");
  const context = useUserContext();
  const postComment = useCallback((clientParams: IPostDocumentCommentClientParams) => {
    return postDocumentComment({ context, ...clientParams });
  }, [context, postDocumentComment]);
  const { onMutate: clientOnMutate, onError: clientOnError, ...otherClientOptions } = options || {};
  return useMutation(postComment, {
    onMutate: async newCommentParams => {
      const { document, comment } = newCommentParams;
      const queryKey = getCommentsQueryKeyFromMetadata(document);
      // snapshot the current state of the comments in case we need to roll back on error
      const rollbackComments = queryKey && queryClient.getQueryData<CommentWithId[]>(queryKey);
      type CommentWithId = WithId<CommentDocument>;
      const newComment: CommentWithId = {
        id: `pending-${uniqueId()}`,
        uid: context.uid || "",
        name: context.name || "",
        network: context.network,
        createdAt: new Date(),
        tileId: comment.tileId,
        content: comment.content
      };
      // optimistically add the new comment (https://react-query.tanstack.com/guides/optimistic-updates)
      queryKey && queryClient.setQueryData<CommentWithId[]>(queryKey, prev => [...(prev || []), newComment]);
      // call client-specified onMutate (if provided)
      clientOnMutate?.({ document, comment });
      // return a context object with the rollback value
      return { rollbackComments };
    },
    onError: (err, newCommentParams, rollbackContext) => {
      const queryKey = getCommentsQueryKeyFromMetadata(newCommentParams.document);
      const rollbackComments = (rollbackContext as any)?.rollbackComments;
      // For now we ignore the possibility that there has been a remote change since we captured
      // the rollback comments. If we encountered an error on write it likely means there's a
      // problem with our connection which means that it's unlikely we've successfully received
      // any updates since we issued the write request. Things should sync up on the next update.
      queryKey && rollbackComments && queryClient.setQueryData(queryKey, rollbackComments);
      clientOnError?.(err, newCommentParams, rollbackContext);
    },
    ...otherClientOptions
  });
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
 * specified document. The documentKey can be either a curriculum section path or the
 * key of a user document in Firebase. The returned results are managed by React Query,
 * e.g. caching and reuse if multiple clients request the same comments.
 */
export const useDocumentComments = (documentKeyOrSectionPath?: string) => {
  const { isSuccess } = useCommentableDocument(documentKeyOrSectionPath);
  const path = useCommentsCollectionPath(documentKeyOrSectionPath || "");
  const queryPath = isSuccess ? path : "";
  documentKeyOrSectionPath && queryPath && (commentsQueryKeyMap[documentKeyOrSectionPath] = queryPath);
  const converter = commentConverter;
  return useCollectionOrderedRealTimeQuery(queryPath, { converter, orderBy: "createdAt" });
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
export const useUnreadDocumentComments = (documentKeyOrSectionPath?: string) => {
  // TODO: figure this out; for now it's just a comment counter
  return useDocumentComments(documentKeyOrSectionPath);
};

const historyEntryConverter = {
  toFirestore: (entry: HistoryEntrySnapshot) => {
    throw new Error(
      "We can't convert a raw HistoryEntry to firestore because we need the index from its parent collection");
  },
  fromFirestore: (doc: firebase.firestore.QueryDocumentSnapshot): HistoryEntrySnapshot => {
    const { entry, index } = doc.data();
    console.log("Loading Entry", entry, index);
    return JSON.parse(entry);
  }
};

/**
 * 
 * @param documentKeyOrSectionPath 
 * @param userId optional param that overrides the current user and the network.
 * This is used so teachers can find the path of student documents.
 * @returns 
 */
export const useDocumentHistory = (documentKeyOrSectionPath?: string, userId?: string) => {
  const { isSuccess } = useCommentableDocument(documentKeyOrSectionPath, userId);
  const docPath = useCommentableDocumentPath(documentKeyOrSectionPath || "", userId);
  // docPath could in theory be an empty string which 
  const queryPath = isSuccess && docPath ? `${docPath}/historyEntries` : "";
  const converter = historyEntryConverter;
  return useCollectionOrderedRealTimeQuery(queryPath, { converter, orderBy: "index" });
};
