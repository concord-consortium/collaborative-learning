import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useAppConfig, useClassStore, useStores, useUserStore } from "../../hooks/use-stores";
import { AppConfigModelType } from "../../models/stores/app-config-model";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { PersonalDocument } from "../../models/document/document-types";
import { ENavTab, NavTabSectionModelType  } from "../../models/view/nav-tabs";
import { CanvasComponent } from "../document/canvas";
import { DocumentContextReact } from "../document/document-context";
import { DecoratedDocumentThumbnailItem } from "./decorated-document-thumbnail-item";
import { useLastSupportViewTimestamp } from "../../hooks/use-last-support-view-timestamp";
import NewDocumentIcon from "../../assets/icons/new/add.svg";

import "./document-type-collection.scss";

interface IProps {
  topTab?: ENavTab;
  tab: string;
  section: NavTabSectionModelType;
  index: number;
  horizontal?: boolean;
  numSections: number;
  scale: number;
  selectedDocument?: string;
  selectedSecondaryDocument?: string;
  onSelectNewDocument?: (type: string) => void;
  onSelectDocument?: (document: DocumentModelType) => void;
  shouldHandleStarClick?: boolean;
  allowDelete: boolean;
}

function getNewDocumentLabel(section: NavTabSectionModelType , appConfigStore: AppConfigModelType) {
  let documentLabel = "";
  section.documentTypes.forEach(type => {
    const label = type !== PersonalDocument ? appConfigStore.getDocumentLabel(type, 1) : "";
    if (!documentLabel && label) {
      documentLabel = label;
    }
  });
  return "New " + (documentLabel || "Workspace");
}

export const DocumentCollectionByType: React.FC<IProps> = observer(({
                                  topTab, tab, section, index, numSections=0, scale, selectedDocument,
                                  selectedSecondaryDocument, horizontal, onSelectNewDocument, onSelectDocument,
                                  shouldHandleStarClick, allowDelete }: IProps) => {
  const appConfigStore = useAppConfig();
  const classStore = useClassStore();
  const user = useUserStore();
  const { sectionDocuments } = useStores();
  const showNewDocumentThumbnail = section.addDocument && !!onSelectNewDocument;
  const newDocumentLabel = getNewDocumentLabel(section, appConfigStore);
  const isSinglePanel = numSections < 2;
  const tabName = tab?.toLowerCase().replace(' ', '-');
  const sectionDocs = sectionDocuments.getSectionDocs(section);
  const isTopPanel = index === 0 && numSections > 1;
  const isBottomPanel = index > 0 && index === numSections - 1;

  function handleNewDocumentClick() {
    onSelectNewDocument?.(section.documentTypes[0]);
  }

  // sync user's last support view time stamp to firebase
  useLastSupportViewTimestamp(section.type === "teacher-supports");

  function handleSelectDocument(document: DocumentModelType) {
    onSelectDocument?.(document);
    (section.type === "teacher-supports") && user.setLastSupportViewTimestamp(Date.now());
  }

  const tabPanelDocumentSectionClass = classNames("tab-panel-documents-section", tabName,
                                                  {"top-panel": isTopPanel, horizontal});
  const bottomPanel = isBottomPanel && !isSinglePanel && sectionDocs.length > 0;
  const listClass = classNames("documents-list", tabName, {"top-panel": isTopPanel, horizontal,
                                "bottom-panel": bottomPanel});
  return (
    <div className={tabPanelDocumentSectionClass}
          key={`${tab}-${section.type}`}
          data-test={`${section.dataTestHeader}-documents`}>
      <div className={listClass}>
        {showNewDocumentThumbnail &&
          <NewDocumentThumbnail label={newDocumentLabel} onClick={handleNewDocumentClick} />}
        {sectionDocs.map((document) => {
          const documentContext = getDocumentContext(document);
          return (
            <DocumentContextReact.Provider key={document.key} value={documentContext}>
              <DecoratedDocumentThumbnailItem
                document={document}
                tab={tab}
                scale={scale}
                selectedDocument={selectedDocument}
                selectedSecondaryDocument={selectedSecondaryDocument}
                onSelectDocument={handleSelectDocument}
                shouldHandleStarClick={shouldHandleStarClick ?? false}
                allowDelete={allowDelete}
              />
            </DocumentContextReact.Provider>
          );
        })}
      </div>
    </div>
  );
});
DocumentCollectionByType.displayName = "DocumentCollectionByType";
interface INewDocumentThumbnailProps {
  label?: string;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const NewDocumentThumbnail: React.FC<INewDocumentThumbnailProps> = ({ label, onClick }) => {
  return (
    <div className="list-item" data-test="my-work-new-document" >
      <div className="scaled-list-item-container new-document-button" onClick={onClick} >
        <div className="scaled-list-item">
          <CanvasComponent context="my-work" readOnly={true} />
        </div>
        <div className="new-document-button-label">
          <NewDocumentIcon />
          <label>{label}</label>
        </div>
      </div>
    </div>
  );
};
