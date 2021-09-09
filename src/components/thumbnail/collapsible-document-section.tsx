import React, { useState } from "react";
import { observer } from "mobx-react";
import { NavTabSectionModelType } from "../../models/view/nav-tabs";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { DocumentContextReact } from "../document/document-context";
import { TabPanelDocumentsSubSectionPanel } from "./tab-panel-documents-subsection-panel";
import { DocumentCaption } from "./document-caption";
import { IStores } from "../../models/stores/stores";
import ArrowIcon from "../../assets/icons/arrow/arrow.svg";
import NotSharedIcon from "../../assets/icons/share/not-share.svg";

import "./tab-panel-documents-section.sass";
import "./collapsible-document-section.scss";


interface IProps {
  userName: string;
  classNameStr: string;
  sectionDocs: DocumentModelType[];
  section: NavTabSectionModelType;
  stores: IStores;
  tab: string;
  scale: number;
  selectedDocument?: string;
  onSelectDocument?: (document: DocumentModelType) => void;
}

export const CollapsibleDocumentsSection: React.FC<IProps> = observer(({userName, classNameStr, sectionDocs, section,
                                                                        stores, tab, scale, selectedDocument,
                                                                        onSelectDocument}) => {
  const [isOpen, setIsOpen] = useState(true);
  const handleSectionToggle = () => {
    setIsOpen(!isOpen);
  };
  return (
    <div className="collapsible-documents-section">
      <div className="section-collapse-toggle" onClick={handleSectionToggle}>
        <div className="teacher-class-info">
          {userName} / {classNameStr}
        </div>
        <ArrowIcon className={`arrow-icon ${isOpen ? "open": ""}`} />
      </div>
      { isOpen &&
        <div className="list">
          {sectionDocs.map(document => {
            const documentContext = getDocumentContext(document);
            const docNotShared = document.visibility === "private";
            const docLabel = document?.title || "Untitled";
            return (
              <DocumentContextReact.Provider key={document.key} value={documentContext}>
                { docNotShared
                  ? <DocumentNoSharedThumbnail label={docLabel} notShared={docNotShared} />
                  : <TabPanelDocumentsSubSectionPanel section={section} sectionDocument={document} tab={tab}
                      stores={stores} scale={scale} selectedDocument={selectedDocument}
                      onSelectDocument={onSelectDocument}
                    />
                }
              </DocumentContextReact.Provider>
            );
          })}
        </div>
      }
    </div>
  );
});

interface IDocumentNotSharedProps {
  label: string;
  notShared?: boolean;
}
const DocumentNoSharedThumbnail: React.FC<IDocumentNotSharedProps> = ({ label, notShared }) => {
  return (
    <div className="list-item not-shared" data-test="my-work-new-document" >
      { notShared
          ? <div className="not-shared">
              <NotSharedIcon className="not-shared-icon" />
            </div>
          : <div className="scaled-list-item-container new-document-button" >
              <div className="scaled-list-item"></div>
            </div>
      }
      <DocumentCaption captionText={label} />
    </div>
  );
};
