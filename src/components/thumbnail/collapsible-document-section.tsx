import React, { useState } from "react";
import { observer } from "mobx-react";
import { ENavTabOrder, NavTabSectionModelType } from "../../models/view/nav-tabs";
import { isUnpublishedType, isPublishedType } from "../../models/document/document-types";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { IStores } from "../../models/stores/stores";
import ArrowIcon from "../../assets/icons/arrow/arrow.svg";
import NotSharedIcon from "../../assets/icons/share/not-share.svg";

import "./tab-panel-documents-section.sass";
import "./collapsible-document-section.scss";
import { DocumentContextReact } from "../document/document-context";
import { TabPanelDocumentsSubSectionPanel } from "./tab-panel-documents-subsection-panel";
import { DocumentCaption } from "./document-caption";

interface IProps {
  userName: string;
  classNameStr: string;
  section: NavTabSectionModelType;
  stores: IStores;
  tab: string;
  scale: number;
  selectedDocument?: string;
  onSelectDocument?: (document: DocumentModelType) => void;
}

export const CollapsibleDocumentsSection: React.FC<IProps> = observer(({userName, classNameStr, section, stores,
                                                                        tab, scale, selectedDocument,
                                                                        onSelectDocument}) => {
  const { documents, user } = stores;
  const [isOpen, setIsOpen] = useState(true);
  let sectionDocs: DocumentModelType[] = [];
  const publishedDocs: { [source: string]: DocumentModelType } = {};

  const handleSectionToggle = () => {
    setIsOpen(!isOpen);
  };
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
