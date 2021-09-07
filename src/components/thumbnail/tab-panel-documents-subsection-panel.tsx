import React from "react";
import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { DocumentModelType } from "../../models/document/document";
import {
  isPlanningType, isProblemType, isPublishedType, SupportPublication
} from "../../models/document/document-types";
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

function getDocumentCaption(stores: IStores, document: DocumentModelType) {
  const { appConfig, problem, class: _class } = stores;
  const { type, uid } = document;
  if (type === SupportPublication) return document.getProperty("caption") || "Support";
  const user = _class && _class.getUserById(uid);
  const userName = user && user.displayName;
  const namePrefix = isPublishedType(type) ? `${userName}: ` : "";
  const title = isProblemType(type)
                  ? problem.title
                  : isPlanningType(type)
                      ? `${problem.title}: Planning`
                      : document.getDisplayTitle(appConfig);
  return `${namePrefix}${title}`;
}

export const TabPanelDocumentsSubSectionPanel = ({section, sectionDocument, tab, stores, scale, selectedDocument,
                                                  onSelectDocument, onDocumentDragStart,
                                                  onDocumentStarClick, onDocumentDeleteClick}: IProps) => {
    const { user } = stores;
    const tabName = tab.toLowerCase().replace(' ', '-');

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
    const _handleDocumentStarClick = section.showStarsForUser(user)
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
        captionText={getDocumentCaption(stores, sectionDocument)}
        onDocumentClick={handleDocumentClick} onDocumentDragStart={handleDocumentDragStart}
        onIsStarred={onIsStarred}
        onDocumentStarClick={_handleDocumentStarClick}
        onDocumentDeleteClick={_handleDocumentDeleteClick}
      />
    );
};
