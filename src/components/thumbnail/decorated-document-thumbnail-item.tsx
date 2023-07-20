import { observer } from "mobx-react";
import React from "react";
import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { useDocumentSyncToFirebase } from "../../hooks/use-document-sync-to-firebase";
import { useFirestoreTeacher } from "../../hooks/firestore-hooks";
import { useLastSupportViewTimestamp } from "../../hooks/use-last-support-view-timestamp";
import { DocumentModelType } from "../../models/document/document";
import { isPublishedType, SupportPublication } from "../../models/document/document-types";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import { useAppConfig, useClassStore, useDBStore, useProblemStore, useUserStore } from "../../hooks/use-stores";
import { NavTabSectionModelType } from "../../models/view/nav-tabs";

import "./document-type-collection.sass";

interface IProps {
  sectionDocument: DocumentModelType;
  tab: string;
  section: NavTabSectionModelType;
  scale: number;
  selectedDocument?: string;
  selectedSecondaryDocument?: string;
  onSelectDocument?: (document: DocumentModelType) => void;
  onDocumentDragStart?: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
  onDocumentDeleteClick?: (document: DocumentModelType) => void;
}

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

// observes teacher names via useDocumentCaption()
export const DecoratedDocumentThumbnailItem: React.FC<IProps> = observer(({
  section, sectionDocument, tab, scale, selectedDocument, selectedSecondaryDocument,
  onSelectDocument, onDocumentDragStart, onDocumentStarClick, onDocumentDeleteClick
}: IProps) => {
    const user = useUserStore();
    const dbStore = useDBStore();
    const tabName = tab.toLowerCase().replace(' ', '-');
    const caption = useDocumentCaption(sectionDocument);

    // sync delete a publication to firebase
    useDocumentSyncToFirebase(user, dbStore.firebase, sectionDocument, true);

    // sync user's last support view time stamp to firebase
    useLastSupportViewTimestamp(section.type === "teacher-supports");

    function handleDocumentClick() {
      onSelectDocument?.(sectionDocument);
      (section.type === "teacher-supports") && user.setLastSupportViewTimestamp(Date.now());
    }
    function handleDocumentDragStart(e: React.DragEvent<HTMLDivElement>) {
      onDocumentDragStart?.(e, sectionDocument);
    }
    function handleDocumentStarClick() {
      onDocumentStarClick?.(sectionDocument);
    }
    function handleDocumentDeleteClick() {
      onDocumentDeleteClick?.(sectionDocument);
    }
    // pass function so logic stays here but access occurs from child
    // so that mobx-react triggers child render not parent render.
    const onIsStarred = () => {
      return section.showStarsForUser(user)
          // We weren't showing stars that a "co-teacher" has placed on a document even though the document
          // is classified as "isStarred". We commented out lines 88-90 to show all starred documents regardless of who
          // placed the star.
              // ? user.isTeacher
              //   ? sectionDocument.isStarredByUser(user.id)
              //   : sectionDocument.isStarred
                ? sectionDocument.isStarred
                : false;
    };
    const _handleDocumentStarClick = section.showStarsForUser(user) && !sectionDocument.isRemote
                                      ? handleDocumentStarClick
                                      : undefined;
    const _handleDocumentDeleteClick = section.showDeleteForUser(user, sectionDocument)
                                        ? handleDocumentDeleteClick
                                        : undefined;

    return (
      <ThumbnailDocumentItem
        key={sectionDocument.key}
        dataTestName={`${tabName}-list-items`}
        canvasContext={tab}
        document={sectionDocument}
        scale={scale}
        isSelected={sectionDocument.key === selectedDocument}
        isSecondarySelected={sectionDocument.key === selectedSecondaryDocument}
        captionText={caption}
        onDocumentClick={handleDocumentClick}
        onDocumentDragStart={!sectionDocument.isRemote ? handleDocumentDragStart: undefined}
        onIsStarred={onIsStarred}
        onDocumentStarClick={_handleDocumentStarClick}
        onDocumentDeleteClick={_handleDocumentDeleteClick}
      />
    );
});
DecoratedDocumentThumbnailItem.displayName = "DecoratedDocumentThumbnailItem";
