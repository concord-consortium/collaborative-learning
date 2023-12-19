import React, { useCallback } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useAppConfig, useClassStore, useLocalDocuments, useUserStore } from "../../hooks/use-stores";
import { AppConfigModelType } from "../../models/stores/app-config-model";
import { DocumentsModelType } from "../../models/stores/documents";
import { UserModelType } from "../../models/stores/user";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { isPublishedType, isUnpublishedType, PersonalDocument } from "../../models/document/document-types";
import { ENavTab, ENavTabOrder, NavTabSectionModelType  } from "../../models/view/nav-tabs";
import { CanvasComponent } from "../document/canvas";
import { DocumentContextReact } from "../document/document-context";
import { DecoratedDocumentThumbnailItem } from "./decorated-document-thumbnail-item";
import NewDocumentIcon from "../../assets/icons/new/add.svg";

import "./document-type-collection.sass";

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
  onDocumentDragStart: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
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

function getSectionDocs(section: NavTabSectionModelType, documents: DocumentsModelType, user: UserModelType,
  isTeacherDocument: (document: DocumentModelType) => boolean) {
  let sectDocs: DocumentModelType[] = [];
  (section.documentTypes || []).forEach(type => {
    if (isUnpublishedType(type)) {
      sectDocs.push(...documents.byTypeForUser(type as any, user.id));
    }
    else if (isPublishedType(type)) {
      const publishedDocs: { [source: string]: DocumentModelType[] } = {};
      documents
        .byType(type as any)
        .forEach(doc => {
          // personal documents and learning logs have originDocs.
          // problem documents only have the uids of their creator,
          // but as long as we're scoped to a single problem, there
          // shouldn't be published documents from other problems.
          const source = doc.originDoc || doc.uid;
          if (source) {
            if (!publishedDocs.source) {
              publishedDocs.source = [];
            }
            publishedDocs.source.push(doc);
          }
        });
      for (const sourceId in publishedDocs) {
        sectDocs.push(...publishedDocs[sourceId]);
      }
    }
  });
  // Reverse the order to approximate a most-recently-used ordering.
  if (section.order === ENavTabOrder.kReverse) {
    sectDocs = sectDocs.reverse();
  }
  // filter by additional properties
  if (section.properties && section.properties.length) {
    sectDocs = sectDocs.filter(doc => doc.matchProperties(section.properties,
                                                          { isTeacherDocument: isTeacherDocument(doc) }));
  }
  return sectDocs;
}

export const DocumentCollectionByType: React.FC<IProps> = observer(({
                                  topTab, tab, section, index, numSections=0, scale, selectedDocument,
                                  selectedSecondaryDocument, horizontal, onSelectNewDocument, onSelectDocument,
                                  onDocumentDragStart, onDocumentStarClick }: IProps) => {
  const appConfigStore = useAppConfig();
  const classStore = useClassStore();
  const documents = useLocalDocuments();
  const user = useUserStore();
  const showNewDocumentThumbnail = section.addDocument && !!onSelectNewDocument;
  const newDocumentLabel = getNewDocumentLabel(section, appConfigStore);
  const isSinglePanel = numSections < 2;
  const tabName = tab?.toLowerCase().replace(' ', '-');
  const isTeacherDocument = useCallback((document: DocumentModelType) => {
      return classStore.isTeacher(document.uid);
    },[classStore]);
  const sectionDocs: DocumentModelType[] = getSectionDocs(section, documents, user, isTeacherDocument);
  const isTopPanel = index === 0 && numSections > 1;
  const isBottomPanel = index > 0 && index === numSections - 1;

  function handleNewDocumentClick() {
    onSelectNewDocument?.(section.documentTypes[0]);
  }
  const tabPanelDocumentSectionClass = classNames("tab-panel-documents-section", tabName,
                                                  {"top-panel": isTopPanel, horizontal});
  const bottomPanel = isBottomPanel && !isSinglePanel && sectionDocs.length > 0;
  const listClass = classNames("list", tabName, {"top-panel": isTopPanel, horizontal,
                                "bottom-panel": bottomPanel});
  return (
    <div className={tabPanelDocumentSectionClass}
          key={`${tab}-${section.type}`}
          data-test={`${section.dataTestHeader}-documents`}>
      {(classStore.isTeacher(sectionDocs[0]?.uid) && topTab === ENavTab.kClassWork && !isBottomPanel)
        && <div className="document-divider">
              <div className="document-divider-label">Teacher Documents</div>
           </div>
      }
      {/* Make a component like whats below, and pass it something like allDocs instead of sectionDocs as above
          Move the handlers to thumbnail component(s) first? You will need to eventually.
          We might need to support overriding them - in the parent of the thumbnail

          We are also going to have to dumb-down DecoratedDocumentThumbanil item in the tabs department:
          In the thumbnail path below, stuff like section.showStars - should no
          longer be pulled from props.section.Instead should be defined
          as props in thumbnail components, and passed from
          ours as hard coded, and from here as values dervied from section value
      */}
      <div className={listClass}>
        {showNewDocumentThumbnail &&
          <NewDocumentThumbnail label={newDocumentLabel} onClick={handleNewDocumentClick} />}
        {sectionDocs.map((document) => {
          const documentContext = getDocumentContext(document);
          return (
            <DocumentContextReact.Provider key={document.key} value={documentContext}>
              <DecoratedDocumentThumbnailItem
                section={section}
                sectionDocument={document}
                tab={tab}
                scale={scale}
                selectedDocument={selectedDocument}
                selectedSecondaryDocument={selectedSecondaryDocument}
                onSelectDocument={onSelectDocument}
                onDocumentDragStart={onDocumentDragStart}
                onDocumentStarClick={onDocumentStarClick}
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
