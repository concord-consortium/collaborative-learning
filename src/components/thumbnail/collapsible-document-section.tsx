import React, { useState } from "react";
import { observer } from "mobx-react";
import { INetworkResourceClassResponse } from "../../../functions/src/shared";
import { DocumentModelType } from "../../models/document/document";
// import { DocumentCaption } from "./document-caption";
import { IStores } from "../../models/stores/stores";
import ArrowIcon from "../../assets/icons/arrow/arrow.svg";
// import NotSharedIcon from "../../assets/icons/share/not-share.svg";
import { ISubTabSpec } from "../navigation/document-tab-panel";

import "./tab-panel-documents-section.sass";
import "./collapsible-document-section.scss";

interface IProps {
  userName: string;
  classNameStr: string;
  stores?: IStores;
  tab?: string;
  scale?: number;
  selectedDocument?: string;
  onSelectDocument?: (document: DocumentModelType) => void;
  subTab: ISubTabSpec;
  networkResource: INetworkResourceClassResponse;
  problem: string;
}

export const CollapsibleDocumentsSection: React.FC<IProps> = observer(
  ({userName, classNameStr, stores, tab, scale, selectedDocument, onSelectDocument, subTab,
    networkResource, problem}) => {
  const [isOpen, setIsOpen] = useState(false);
  const handleSectionToggle = () => {
    setIsOpen(!isOpen);
  };

  const documentNames: string[] = [];
  subTab.sections.forEach(section => {
    if (section.type === "personal-documents") {
      // get the personal documents
      networkResource.teachers?.forEach((teacher) => {
        if (teacher.personalDocuments) {
          for (const [, document] of Object.entries(teacher.personalDocuments)) {
            documentNames.push(document.title);
          }
        }
      });
    } else if (section.type === "problem-documents") {
      // get the problem and planning documents
      networkResource.resources?.forEach((resource) => {
        resource.teachers?.forEach((teacher) => {
          if (teacher.problemDocuments) {
            for (const [, document] of Object.entries(teacher.problemDocuments)) {
              documentNames.push(problem);
            }
          }
          if (teacher.planningDocuments) {
            for (const [, document] of Object.entries(teacher.planningDocuments)) {
              documentNames.push(`${problem}: planning}`);
            }
          }
        });
      });
    } else if (section.type === "learning-logs") {
      // get the learning logs
      networkResource.teachers?.forEach((teacher) => {
        if (teacher.learningLogs) {
          for (const [, document] of Object.entries(teacher.learningLogs)) {
            documentNames.push(document.title);
          }
        }
      });
    }
  });


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
          { documentNames.length > 0
            ? documentNames.map((docName, i) =>
                <div key={i} style={{padding: "5px 10px"}}>{`DOCUMENT: ${docName}`}</div>)
            : <div style={{padding: "5px 10px"}}>No Documents</div>
          }
          {/* {sectionDocs.map(document => {
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
          })} */}
        </div>
      }
    </div>
  );
});

// interface IDocumentNotSharedProps {
//   label: string;
//   notShared?: boolean;
// }
// const DocumentNoSharedThumbnail: React.FC<IDocumentNotSharedProps> = ({ label, notShared }) => {
//   return (
//     <div className="list-item not-shared" data-test="my-work-new-document" >
//       { notShared
//           ? <div className="not-shared">
//               <NotSharedIcon className="not-shared-icon" />
//             </div>
//           : <div className="scaled-list-item-container new-document-button" >
//               <div className="scaled-list-item"></div>
//             </div>
//       }
//       <DocumentCaption captionText={label} />
//     </div>
//   );
// };
