import { getParent } from "mobx-state-tree";
import { DocumentViewMode } from "../../components/document/document";
import { FourUpUser } from "../../components/four-up";
import { ProblemModelType } from "../curriculum/problem";
import { SectionModelType } from "../curriculum/section";
import { getSectionPath } from "../curriculum/unit";
import { AppConfigModelType } from "../stores/app-config-model";
import { DocumentModelType } from "./document";
import { DocumentContentModelType } from "./document-content";
import { isPlanningType, isProblemType } from "./document-types";

export function getDocumentDisplayTitle(
  document: DocumentModelType, appConfig: AppConfigModelType, problem: ProblemModelType
) {
  const { type } = document;
  return document.isSupport
    ? document.getProperty("caption") || "Support"
    : isProblemType(type)
        ? problem.title
        : isPlanningType(type)
            ? `${problem.title}: Planning`
            : document.getDisplayTitle(appConfig);
}

/**
 * Returns the key for user documents or path for problem documents
 * @param document
 * @returns
 */
export function getDocumentIdentifier(document?: DocumentContentModelType) {
  if (!document) {
    return undefined;
  }

  const parent = getParent(document);
  if (Object.hasOwn(parent, "key")) {
    return (parent as DocumentModelType).key;
  } else {
    const section = parent as SectionModelType;
    return getSectionPath(section);
  }
}

// Utility function that creates an array of dictionaries of students and their docs in a group
export function getGroupUsers(userId: string | undefined, groups: any, documents: any, groupId: string | undefined,
    documentViewMode?: DocumentViewMode) {
  const group = groups.getGroupById(groupId);
  const groupDocuments = group && groupId &&
                         (documentViewMode === DocumentViewMode.Published
                           ? documents.getLastPublishedProblemDocumentsForGroup(groupId)
                           : documents.getProblemDocumentsForGroup(groupId)
                         ) || [];
  const quadrants = [ "four-up-nw", "four-up-ne", "four-up-se", "four-up-sw"];
  const groupUsers: FourUpUser[] = group
    ? group.users
        .map((groupUser: any, idx: number) => {
          const groupUserDoc = groupDocuments && groupDocuments.find((groupDocument: any) => {
            return groupDocument.uid === groupUser.id;
          });
          return {
            user: groupUser,
            doc: groupUserDoc,
            initials: groupUser.initials,
            context: quadrants[idx]
          };
        })
    : [];

   // put the primary user's document first (i.e. in the upper-left corner)
  groupUsers.sort((a, b) => {
    if (a.user.id === userId) return -1;
    if (b.user.id === userId) return 1;
    return 0;
  });
  return groupUsers;
}
