import { useFirestoreTeacher } from "./firestore-hooks";
import { DocumentModelType } from "../models/document/document";
import { ExemplarDocument, isPublishedType, isUnpublishedType } from "../models/document/document-types";
import { getDocumentDisplayTitle } from "../models/document/document-utils";
import { useStores } from "./use-stores";

export function useDocumentCaption(document: DocumentModelType, isStudentWorkspaceDoc?: boolean) {
  const {appConfig, class: classStore, unit, user} = useStores();
  const { type, uid } = document;
  const pubVersion = document.pubVersion;
  const teacher = useFirestoreTeacher(uid, user.network || "");
  const userName = classStore.getUserById(uid)?.displayName
    || teacher?.name
    || (document.isRemote ? teacher?.name : "")
    || "Unknown User";

  const hasNamePrefix =  document.isRemote
    || isPublishedType(type)
    || isUnpublishedType(type)
    // TODO: ExemplarDocument could be in "isPublishedType" or "isUnpiblishedType" test arrays
    || type === ExemplarDocument
    || isStudentWorkspaceDoc;
  const namePrefix = hasNamePrefix ? `${userName}: ` : "";
  const dateSuffix = document.isRemote && document.createdAt
                      ? ` (${new Date(document.createdAt).toLocaleDateString()})`
                      : isPublishedType(type) && pubVersion
                          ? ` v${pubVersion}`
                          : "";
  const title = getDocumentDisplayTitle(unit, document, appConfig);
  return `${namePrefix}${title}${dateSuffix}`;
}
