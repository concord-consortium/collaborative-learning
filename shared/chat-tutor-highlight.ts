// Shape the tutor's reply writes onto an assistant message and the client reads back. Defined in
// shared/ because it is a wire contract between the server (functions-v2) and client packages.
export interface TutorHighlight {
  tileId: string;
  objectId: string;
  label: string;
}
