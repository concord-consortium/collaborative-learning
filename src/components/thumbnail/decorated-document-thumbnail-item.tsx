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
  onSelectDocument?: (document: DocumentModelType) => void;
  onDocumentDragStart?: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
  onDocumentDeleteClick?: (document: DocumentModelType) => void;
}

export function useDocumentCaption(document: DocumentModelType) {
  // console.log("------decorated-document-thumbnail-item.tsx---------");
  // console.log("with document.key:", document.key);
  // console.log("[prop] document:", document);
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
  const namePrefix = document.isRemote || isPublishedType(type) ? `${userName}: ` : "";
  const dateSuffix = document.isRemote && document.createdAt
                      ? ` (${new Date(document.createdAt).toLocaleDateString()})`
                      : isPublishedType(type) && pubVersion
                          ? ` v${pubVersion}`
                          : "";
  const title = getDocumentDisplayTitle(document, appConfig, problem);
  return `${namePrefix}${title}${dateSuffix}`;
}

// observes teacher names via useDocumentCaption()
export const DecoratedDocumentThumbnailItem = observer(({
  section, sectionDocument, tab, scale, selectedDocument,
  onSelectDocument, onDocumentDragStart, onDocumentStarClick, onDocumentDeleteClick
}: IProps) => {
    console.log("------<DecoratedDocumentThumbnail Item > ------------");
    console.log("tab:", tab);
    console.log("section:", section);
    console.log("sectionDocument:", sectionDocument);
    console.log("caption = useDocumentCaption(sectionDocument):", useDocumentCaption(sectionDocument));

    const user = useUserStore();
    const dbStore = useDBStore();
    const tabName = tab.toLowerCase().replace(' ', '-');
    const caption = useDocumentCaption(sectionDocument) + sectionDocument.key;

    // sync delete a publication to firebase
    useDocumentSyncToFirebase(user, dbStore.firebase, sectionDocument, true);

    // sync user's last support view time stamp to firebase
    useLastSupportViewTimestamp(section.type === "teacher-supports");

    function handleDocumentClick() {
      // console.log("decorated-document-thumbnail-item > handleDocumentClick()");
      // console.log("onSelectDocument?:\n", onSelectDocument, "\n with sectionDocument: ", sectionDocument);
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
              ? user.isTeacher
                ? sectionDocument.isStarredByUser(user.id)
                : sectionDocument.isStarred
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
        captionText={caption}
        onDocumentClick={handleDocumentClick}
        onDocumentDragStart={!sectionDocument.isRemote ? handleDocumentDragStart: undefined}
        onIsStarred={onIsStarred}
        onDocumentStarClick={_handleDocumentStarClick}
        onDocumentDeleteClick={_handleDocumentDeleteClick}
      />
    );
});
