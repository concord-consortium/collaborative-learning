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
