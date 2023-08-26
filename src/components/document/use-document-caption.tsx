import { useFirestoreTeacher } from "../../hooks/firestore-hooks";
import { useAppConfig, useClassStore, useProblemStore, useUserStore } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { isPublishedType, SupportPublication } from "../../models/document/document-types";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";

export function useDocumentCaption(document: DocumentModelType, isStudentWorkspaceDoc?: boolean) {
  const appConfig = useAppConfig();
  const problem = useProblemStore();
  const classStore = useClassStore();
  const user = useUserStore();
  const { type, uid } = document;
  const pubVersion = document.pubVersion;
  const teacher = useFirestoreTeacher(uid, user.network || "");
  if (type === SupportPublication) {
    const caption = document.getProperty("caption") || "Support";
    return pubVersion ? `${caption} v${pubVersion}` : `${caption}`;
  }
  const userName = classStore.getUserById(uid)?.displayName || teacher?.name ||
                    (document.isRemote ? teacher?.name : "") || "Unknown User";


  const hasNamePrefix =  document.isRemote || isPublishedType(type) || isStudentWorkspaceDoc;
  const namePrefix = hasNamePrefix ? `${userName}: ` : "";


  const dateSuffix = document.isRemote && document.createdAt
                      ? ` (${new Date(document.createdAt).toLocaleDateString()})`
                      : isPublishedType(type) && pubVersion
                          ? ` v${pubVersion}`
                          : "";
  const title = getDocumentDisplayTitle(document, appConfig, problem);
  return `${namePrefix}${title}${dateSuffix}`;
}
