import React from "react";
import { observer } from "mobx-react";
import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { DocumentModelType, isUnpublishedType, isPublishedType, isProblemType, PersonalDocument, SupportPublication
      } from "../../models/document/document";
import { IStores } from "../../models/stores/stores";
import { ENavTabOrder, NavTabSectionModelType  } from "../../models/view/nav-tabs";
import { CanvasComponent } from "../document/canvas";
import NewDocumentIcon from "../../assets/icons/new/add.svg";

import "./tab-panel-documents-section.sass";

interface IProps {
  tab: string;
  section: NavTabSectionModelType;
  index: number
  numOfSections: number
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

function getDocumentCaption(stores: IStores, document: DocumentModelType) {
  const { appConfig, problem, class: _class } = stores;
  const { type, uid } = document;
  if (type === SupportPublication) return document.getProperty("caption") || "Support";
  const user = _class && _class.getUserById(uid);
  const userName = user && user.displayName;
  const namePrefix = isPublishedType(type) ? `${userName}: ` : "";
  const title = isProblemType(type) ? problem.title : document.getDisplayTitle(appConfig);
  return `${namePrefix}${title}`;
}

export const TabPanelDocumentsSection = observer(({ tab, section, index, numOfSections, stores, scale, selectedDocument,
                                  onSelectNewDocument, onSelectDocument, onDocumentDragStart,
                                  onDocumentStarClick, onDocumentDeleteClick }: IProps) => {
    const { documents, user } = stores;
    const showNewDocumentThumbnail = section.addDocument && !!onSelectNewDocument;
    const newDocumentLabel = getNewDocumentLabel(section, stores);
    let sectionDocs: DocumentModelType[] = [];
    const publishedDocs: { [source: string]: DocumentModelType } = {};
    const numPanels = numOfSections > 1 ? 2 : 1;
    const tabName = tab.toLowerCase().replace(' ', '-');

    (section.documentTypes || []).forEach(type => {
      if (isUnpublishedType(type)) {
        sectionDocs.push(...documents.byTypeForUser(type as any, user.id));
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
        sectionDocs.push(...Object.values(publishedDocs));
      }
    });

    // Reverse the order to approximate a most-recently-used ordering.
    if (section.order === ENavTabOrder.kReverse) {
      sectionDocs = sectionDocs.reverse();
    }

    // filter by additional properties
    if (section.properties && section.properties.length) {
      sectionDocs = sectionDocs.filter(doc => doc.matchProperties(section.properties));
    }

    function handleNewDocumentClick() {
      onSelectNewDocument?.(section.documentTypes[0]);
    }

    return (
      <div className={`tab-panel-documents-section ${tabName} ${index === 0 && numPanels > 1 ? `top-panel`:``}`}
            key={`${tab}-${section.type}`}
            data-test={`${section.dataTestHeader}-documents`}>
        <div className={`list ${tabName} ${index === 0 && numPanels > 1 ? `top-panel`:``}`}>
          {showNewDocumentThumbnail &&
            <NewDocumentThumbnail label={newDocumentLabel} onClick={handleNewDocumentClick} />}

          {sectionDocs.map(document => {

            function handleDocumentClick() {
              onSelectDocument?.(document);
              (section.type === "teacher-supports") && user.setLastSupportViewTimestamp(Date.now());
            }
            function handleDocumentDragStart(e: React.DragEvent<HTMLDivElement>) {
              onDocumentDragStart?.(e, document);
            }
            function handleDocumentStarClick() {
              onDocumentStarClick?.(document);
            }
            function handleDocumentDeleteClick() {
              onDocumentDeleteClick?.(document);
            }

            // pass function so logic stays here but access occurs from child
            // so that mobx-react triggers child render not parent render.
            const onIsStarred = () => {
              return section.showStarsForUser(user)
                      ? user.isTeacher
                        ? document.isStarredByUser(user.id)
                        : document.isStarred
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
                key={document.key}
                dataTestName={`${tabName}-list-items`}
                canvasContext={tab}
                document={document}
                scale={scale}
                isSelected={document.key === selectedDocument}
                captionText={getDocumentCaption(stores, document)}
                onDocumentClick={handleDocumentClick} onDocumentDragStart={handleDocumentDragStart}
                onIsStarred={onIsStarred}
                onDocumentStarClick={_handleDocumentStarClick}
                onDocumentDeleteClick={_handleDocumentDeleteClick}
              />
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
