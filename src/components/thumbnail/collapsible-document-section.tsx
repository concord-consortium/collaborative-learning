import React, { useState } from "react";
import { observer } from "mobx-react";
import { DocumentContextReact } from "../document/document-context";
import { INetworkResourceClassResponse } from "../../../functions/src/shared";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { IStores } from "../../models/stores/stores";
import ArrowIcon from "../../assets/icons/arrow/arrow.svg";
import { ISubTabSpec } from "../navigation/section-document-or-browser";
import { useNetworkDocuments, useUserStore } from "../../hooks/use-stores";
import { TabPanelDocumentsSubSectionPanel } from "./tab-panel-documents-subsection-panel";
import { NavTabSectionModelType } from "../../models/view/nav-tabs";
import { Logger, LogEventName } from "../../lib/logger";

import "./tab-panel-documents-section.sass";
import "./collapsible-document-section.scss";

interface IProps {
  userName: string;
  userId: string;
  classNameStr: string;
  classHash: string;
  stores: IStores;
  scale: number;
  selectedDocument?: string;
  onSelectDocument?: (document: DocumentModelType) => void;
  subTab: ISubTabSpec;
  networkResource: INetworkResourceClassResponse;
  problemTitle: string;
}

export const CollapsibleDocumentsSection: React.FC<IProps> = observer(
  ({userName, classNameStr, stores, scale, selectedDocument, onSelectDocument, subTab,
    networkResource, userId, classHash}) => {
  const [isOpen, setIsOpen] = useState(false);
  const user = useUserStore();
  const handleSectionToggle = () => {
    Logger.log(isOpen
      ? LogEventName.TEACHER_NETWORK_COLLAPSE_DOCUMENT_SECTION
      : LogEventName.TEACHER_NETWORK_EXPAND_DOCUMENT_SECTION, {
      networkClassHash: classHash,
      networkUsername: `${userId}@${user.portal}`
    });
    setIsOpen(!isOpen);
  };

  const documentKeys: string[] = [];
  subTab.sections.forEach(section => {
    if (section.type === "personal-documents") {
      // get the personal documents
      networkResource.teachers?.forEach((teacher) => {
        teacher.personalDocuments && documentKeys.push(...(teacher.personalDocuments as string[]));
      });
    } else if (section.type === "problem-documents") {
      // get the problem and planning documents
      networkResource.resources?.forEach((resource) => {
        resource.teachers?.forEach((teacher) => {
          teacher.problemDocuments && documentKeys.push(...(teacher.problemDocuments as string[]));
          teacher.planningDocuments && documentKeys.push(...(teacher.planningDocuments as string[]));
        });
      });
    } else if (section.type === "learning-logs") {
      // get the learning logs
      networkResource.teachers?.forEach((teacher) => {
        teacher.learningLogs && documentKeys.push(...(teacher.learningLogs as string[]));
      });
    } else if (section.type === "published-personal-documents") {
      // get the published personal documents
      networkResource.personalPublications && documentKeys.push(...(networkResource.personalPublications as string[]));
    } else if (section.type === "published-problem-documents") {
      // get the published problem documents
      networkResource.resources?.forEach((resource) => {
        resource.problemPublications && documentKeys.push(...(resource.problemPublications as string[]));
      });
    } else if (section.type === "published-learning-logs") {
      networkResource.learningLogPublications &&
        documentKeys.push(...(networkResource.learningLogPublications as string[]));
    }
  });

  const networkDocuments = useNetworkDocuments();
  const currentSection = subTab.sections[0] as NavTabSectionModelType;
  const hasDocuments = documentKeys.length > 0;

  return (
    <div className="collapsible-documents-section">
      <div className="section-collapse-toggle" onClick={hasDocuments ? handleSectionToggle : undefined}>
        <div className="teacher-class-info">
          {userName} / {classNameStr}
        </div>
        {hasDocuments && <ArrowIcon className={`arrow-icon ${isOpen ? "open": ""}`} />}
      </div>
      { isOpen &&
        <div className="list">
          {hasDocuments
            ? documentKeys.map((key, i) => {
              const document = networkDocuments.getDocument(key);
              if (!document) return <div>Document Missing</div>;
              const documentContext = getDocumentContext(document);
              return (
                <DocumentContextReact.Provider key={document.key} value={documentContext}>
                  <TabPanelDocumentsSubSectionPanel section={currentSection} sectionDocument={document}
                    tab={subTab.label} scale={scale} selectedDocument={selectedDocument}
                    onSelectDocument={() => onSelectDocument?.(document)}
                  />
                </DocumentContextReact.Provider>
              );
            })
            : <div style={{padding: "5px 10px"}}>No Documents Found</div>
          }
        </div>
      }
    </div>
  );
});
