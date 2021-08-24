/*
 * Types that are shared between cloud functions and client code.
 */
export interface IUserContext {
  appMode: string;
  demoName?: string;
  portal?: string;
  uid?: string;                 // user id of caller; validated for authenticated users when provided
  type?: "student" | "teacher"; // user's role
  name?: string;
  network?: string;             // current network for teachers
  classHash: string;
  teachers?: string[];          // user ids of class's teachers
}

/*
 * networkDocumentKey
 *
 * To accommodate the fact that the same document can be commented upon in multiple networks, the
 * id of a document in the documents collection is a mashup of the network and the document key.
 */
export const networkDocumentKey = (documentKey: string, network?: string) =>
              network ? `${network}_${documentKey}` : documentKey;

export interface IDocumentMetadata {
  uid: string;
  type: string;
  key: string;
  createdAt: number;
  title?: string;
  originDoc?: string;
  properties?: Record<string, string>;
}

export interface IPostCommentParams {
  context: IUserContext,
  document: IDocumentMetadata,
  comment: {
    tileId?: string;      // empty for document comments
    content: string;      // plain text for now; potentially html if we need rich text
  }
}
