import React from "react";
import { observer } from "mobx-react";
import { uniq } from "lodash";
import classNames from "classnames";
import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import {
  isPlanningType, isProblemType, isPublishedType, isUnpublishedType, PersonalDocument, SupportPublication
} from "../../models/document/document-types";
import { IStores } from "../../models/stores/stores";
import { ENavTabOrder, NavTabSectionModelType  } from "../../models/view/nav-tabs";
import { CanvasComponent } from "../document/canvas";
import { DocumentContextReact } from "../document/document-context";
import NewDocumentIcon from "../../assets/icons/new/add.svg";

import "./tab-panel-documents-section.sass";

interface IProps {
  sectionDocuments: DocumentModelType[];
  tab: string;
  section: NavTabSectionModelType;
  index: number;
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
  const title = isProblemType(type)
                  ? problem.title
                  : isPlanningType(type)
                      ? `${problem.title}: Planning`
                      : document.getDisplayTitle(appConfig);
  return `${namePrefix}${title}`;
}

export const TabPanelDocumentsSubSectionPanel = ({section, sectionDocuments, tab, stores, scale, selectedDocument,
                                                  onSelectNewDocument, onSelectDocument, onDocumentDragStart,
                                                  onDocumentStarClick, onDocumentDeleteClick}: IProps) => {
    const { documents, user } = stores;
    const isInNetwork = user.type === "teacher" && user.teacherNetwork;
    const showNewDocumentThumbnail = section.addDocument && !!onSelectNewDocument;
    const newDocumentLabel = getNewDocumentLabel(section, stores);
    // let sectionDocs: DocumentModelType[] = [];
    // const publishedDocs: { [source: string]: DocumentModelType } = {};

    const tabName = tab.toLowerCase().replace(' ', '-');

    function handleNewDocumentClick() {
      onSelectNewDocument?.(section.documentTypes[0]);
    }
    return (
      {sectionDocuments.map((document: DocumentModelType) => {
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
        const documentContext = getDocumentContext(document);
        return (
          <DocumentContextReact.Provider key={document.key} value={documentContext}>
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
              </DocumentContextReact.Provider>
        );
      })}
    );
  }


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
