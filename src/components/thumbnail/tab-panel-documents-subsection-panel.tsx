import { observer } from "mobx-react";
import React from "react";
import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { useFirestoreTeacher } from "../../hooks/firestore-hooks";
import { useLastSupportViewTimestamp } from "../../hooks/use-last-support-view-timestamp";
import { DocumentModelType } from "../../models/document/document";
import { isPublishedType, SupportPublication } from "../../models/document/document-types";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import { IStores } from "../../models/stores/stores";
import { NavTabSectionModelType } from "../../models/view/nav-tabs";

import "./tab-panel-documents-section.sass";

interface IProps {
  sectionDocument: DocumentModelType;
  tab: string;
  section: NavTabSectionModelType;
  stores: IStores;
  scale: number;
  selectedDocument?: string;
  onSelectDocument?: (document: DocumentModelType) => void;
  onDocumentDragStart?: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
  onDocumentDeleteClick?: (document: DocumentModelType) => void;
}

function useDocumentCaption(stores: IStores, document: DocumentModelType) {
  const { appConfig, problem, class: _class, user: { network } } = stores;
  const { type, uid } = document;
  const teacher = useFirestoreTeacher(uid, network || "");
  if (type === SupportPublication) return document.getProperty("caption") || "Support";
  const userName = _class?.getUserById(uid)?.displayName ||
                    (document.isRemote ? teacher?.name : "") || "Unknown User";
  const namePrefix = document.isRemote || isPublishedType(type) ? `${userName}: ` : "";
  const dateSuffix = document.isRemote && document.createdAt
                      ? ` (${new Date(document.createdAt).toLocaleDateString()})` : "";
  const title = getDocumentDisplayTitle(document, appConfig, problem);
  return `${namePrefix}${title}${dateSuffix}`;
}

// observes teacher names via useDocumentCaption()
export const TabPanelDocumentsSubSectionPanel = observer(({
  section, sectionDocument, tab, stores, scale, selectedDocument,
  onSelectDocument, onDocumentDragStart, onDocumentStarClick, onDocumentDeleteClick
}: IProps) => {
    const { user } = stores;
    const tabName = tab.toLowerCase().replace(' ', '-');
    const caption = useDocumentCaption(stores, sectionDocument);

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
              ? user.isTeacher
                ? sectionDocument.isStarredByUser(user.id)
                : sectionDocument.isStarred
              : false;
    };
    const _handleDocumentStarClick = section.showStarsForUser(user) && !sectionDocument.isRemote
                                      ? handleDocumentStarClick
                                      : undefined;
    const _handleDocumentDeleteClick = section.showDeleteForUser(user)
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
