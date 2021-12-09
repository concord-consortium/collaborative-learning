import React, { useState } from "react";
import { useQueryClient } from 'react-query';
import { DocumentModelType } from "../../models/document/document";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import { ENavTabSectionType, NavTabSpec } from "../../models/view/nav-tabs";
import { DocumentTabPanel } from "./document-tab-panel";
import { EditableDocumentContent } from "../document/editable-document-content";
import { useAppConfigStore, useProblemStore, useUIStore, useUserStore } from "../../hooks/use-stores";
import { Logger, LogEventName } from "../../lib/logger";
import EditIcon from "../../clue/assets/icons/edit-right-icon.svg";
import { useUserContext } from "../../hooks/use-user-context";

import "./document-tab-content.sass";

interface IProps {
  tabSpec: NavTabSpec;
}

export const DocumentTabContent: React.FC<IProps> = ({ tabSpec }) => {
  const [referenceDocument, setReferenceDocument] = useState<DocumentModelType>();
  const appConfigStore = useAppConfigStore();
  const problemStore = useProblemStore();
  const context = useUserContext();
  const queryClient = useQueryClient();
  const ui = useUIStore();
  const user = useUserStore();

  const handleTabClick = (title: string, type: string) => {
    setReferenceDocument(undefined);
    ui.updateFocusDocument();
    ui.setSelectedTile();
    Logger.log(LogEventName.SHOW_TAB_SECTION, {
      tab_section_name: title,
      tab_section_type: type
    });
  };

  const handleSelectDocument = (document: DocumentModelType) => {
    if (!document.hasContent && document.isRemote) {
      loadDocumentContent(document);
    }
    setReferenceDocument(document);
    ui.updateFocusDocument();
  };

  const loadDocumentContent = async (document: DocumentModelType) => {
    await document.fetchRemoteContent(queryClient, context);
  };

  function handleEditClick(document: DocumentModelType) {
    ui.problemWorkspace.setPrimaryDocument(document);
  }

  const editButton = (type: string, sClass: string, document: DocumentModelType) => {
    return (
      (type === "my-work") || (type === "learningLog")
        ?
          <div className={`edit-button ${sClass}`} onClick={() => handleEditClick(document)}>
            <EditIcon className={`edit-icon ${sClass}`} />
            <div>Edit</div>
          </div>
        : null
    );
  };

  const sectionClass = referenceDocument?.type === "learningLog" ? "learning-log" : "";
  const selectedSection = tabSpec.tab === "supports" ? ENavTabSectionType.kTeacherSupports : undefined;
  const documentView = referenceDocument && !referenceDocument?.getProperty("isDeleted") &&
    <div>
      <div className={`document-header ${tabSpec.tab} ${sectionClass}`} onClick={() => ui.setSelectedTile()}>
        <div className={`document-title`}>
          {getDocumentDisplayTitle(referenceDocument, appConfigStore, problemStore)}
        </div>
        {!referenceDocument.isRemote && editButton(tabSpec.tab, sectionClass, referenceDocument)}
      </div>
      <EditableDocumentContent
        mode={"1-up"}
        isPrimary={false}
        document={referenceDocument}
        readOnly={true}
      />
    </div>;

  return (
    <div className="document-tab-content">
      <DocumentTabPanel
        tabSpec={tabSpec}
        selectedSection={selectedSection}
        onTabClick={handleTabClick}
        onSelectDocument={handleSelectDocument}
        documentView={documentView}
        showNetworkDocuments={user.isNetworkedTeacher}
      />
    </div>
  );
};
