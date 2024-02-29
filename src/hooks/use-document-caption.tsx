import { useFirestoreTeacher } from "./firestore-hooks";
import { useAppConfig, useClassStore, useProblemStore, useUserStore } from "./use-stores";
import { DocumentModelType } from "../models/document/document";
import { isPublishedType, isUnpublishedType } from "../models/document/document-types";
import { getDocumentDisplayTitle } from "../models/document/document-utils";

export function useDocumentCaption(document: DocumentModelType, isStudentWorkspaceDoc?: boolean) {
  const appConfig = useAppConfig();
  const problem = useProblemStore();
  const classStore = useClassStore();
  const user = useUserStore();
  const { type, uid } = document;
  const pubVersion = document.pubVersion;
  const teacher = useFirestoreTeacher(uid, user.network || "");
  const userName = classStore.getUserById(uid)?.displayName
    || teacher?.name
    || (document.isRemote ? teacher?.name : "")
    || "Unknown User";

  const hasNamePrefix =  document.isRemote || isPublishedType(type) || isUnpublishedType(type) || isStudentWorkspaceDoc;
  const namePrefix = hasNamePrefix ? `${userName}: ` : "";
  const dateSuffix = document.isRemote && document.createdAt
                      ? ` (${new Date(document.createdAt).toLocaleDateString()})`
                      : isPublishedType(type) && pubVersion
                          ? ` v${pubVersion}`
                          : "";
  const title = getDocumentDisplayTitle(document, appConfig, problem);
  return `${namePrefix}${title}${dateSuffix}`;
}
