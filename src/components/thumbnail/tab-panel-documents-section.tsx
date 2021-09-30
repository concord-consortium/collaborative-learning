import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { isPublishedType, isUnpublishedType, PersonalDocument } from "../../models/document/document-types";
import { IStores } from "../../models/stores/stores";
import { ENavTabOrder, NavTabSectionModelType  } from "../../models/view/nav-tabs";
import { CanvasComponent } from "../document/canvas";
import { DocumentContextReact } from "../document/document-context";
import { TabPanelDocumentsSubSectionPanel } from "./tab-panel-documents-subsection-panel";
import NewDocumentIcon from "../../assets/icons/new/add.svg";

import "./tab-panel-documents-section.sass";

interface IProps {
  tab: string;
  section: NavTabSectionModelType;
  index: number;
  numOfSections: number;
  stores: IStores;
  scale: number;
  selectedDocument?: string;
  onSelectNewDocument?: (type: string) => void;
  onSelectDocument?: (document: DocumentModelType) => void;
  onDocumentDragStart: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
  onDocumentDeleteClick?: (document: DocumentModelType) => void;
}

function getNewDocumentLabel(section: NavTabSectionModelType , stores: IStores) {
  const { appConfig } = stores;
  let documentLabel = "";
  section.documentTypes.forEach(type => {
    const label = type !== PersonalDocument ? appConfig.getDocumentLabel(type, 1) : "";
    if (!documentLabel && label) {
      documentLabel = label;
    }
  });
  return "New " + (documentLabel || "Workspace");
}

function getSectionDocs(section: NavTabSectionModelType, stores: IStores, classStr: string) {
  const { documents, user } = stores;
  const publishedDocs: { [source: string]: DocumentModelType } = {};
  let sectDocs: DocumentModelType[] = [];
  (section.documentTypes || []).forEach(type => {
    if (isUnpublishedType(type)) {
      sectDocs.push(...documents.byTypeForUser(type as any, user.id));
    }
    else if (isPublishedType(type)) {
      // only show the most recent publication of each document
      documents
        .byType(type as any)
        .forEach(doc => {
          // personal documents and learning logs have originDocs.
          // problem documents only have the uids of their creator,
          // but as long as we're scoped to a single problem, there
          // shouldn't be published documents from other problems.
          const source = doc.originDoc || doc.uid;
          if (source) {
            const entry = publishedDocs[source];
            if (!entry || (entry.createdAt < doc.createdAt)) {
              publishedDocs[source] = doc;
            }
          }
        });
        sectDocs.push(...Object.values(publishedDocs));
    }
  });

  // Reverse the order to approximate a most-recently-used ordering.
  if (section.order === ENavTabOrder.kReverse) {
    sectDocs = sectDocs.reverse();
  }
  // filter by additional properties
  if (section.properties && section.properties.length) {
    sectDocs = sectDocs.filter(doc => doc.matchProperties(section.properties));
  }
  return sectDocs;
}

export const TabPanelDocumentsSection = observer(({ tab, section, index, numOfSections, stores, scale, selectedDocument,
                                  onSelectNewDocument, onSelectDocument, onDocumentDragStart,
                                  onDocumentStarClick, onDocumentDeleteClick }: IProps) => {
    const { user } = stores;
    const isInNetwork = user.type === "teacher" && user.network;
    const showNewDocumentThumbnail = section.addDocument && !!onSelectNewDocument;
    const newDocumentLabel = getNewDocumentLabel(section, stores);
    const numPanels = isInNetwork ? numOfSections + 1 : numOfSections;
    const isTopPanel = index === 0 && numPanels > 1;
    const isBottomPanel = index === numOfSections - 1 && index > 0;
    const tabName = tab.toLowerCase().replace(' ', '-');
    const currentClass = stores.class.name;
    const sectionDocs: DocumentModelType[] = getSectionDocs(section, stores, currentClass);

    function handleNewDocumentClick() {
      onSelectNewDocument?.(section.documentTypes[0]);
    }
    const tabPanelDocumentSectionClass = classNames("tab-panel-documents-section", tabName,
                                                    { "top-panel": isTopPanel }, { "bottom-panel": isBottomPanel });
    const listClass = classNames("list", tabName, {"top-panel": isTopPanel}, {"bottom-panel": isBottomPanel});
    return (
      <div className={tabPanelDocumentSectionClass}
            key={`${tab}-${section.type}`}
            data-test={`${section.dataTestHeader}-documents`}>
        <div className={listClass}>
          {showNewDocumentThumbnail &&
            <NewDocumentThumbnail label={newDocumentLabel} onClick={handleNewDocumentClick} />}

          {sectionDocs.map(document => {
            const documentContext = getDocumentContext(document);
            return (
              <DocumentContextReact.Provider key={document.key} value={documentContext}>
                <TabPanelDocumentsSubSectionPanel section={section} sectionDocument={document} tab={tab} stores={stores}
                  scale={scale} selectedDocument={selectedDocument}
                  onSelectDocument={onSelectDocument}
                  onDocumentDragStart={onDocumentDragStart}
                  onDocumentStarClick={onDocumentStarClick}
                  onDocumentDeleteClick={onDocumentDeleteClick}
                />
              </DocumentContextReact.Provider>
            );
          })}
        </div>
      </div>
    );
  });

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
