import React, { useState } from "react";
import { DocumentModelType, isProblemType } from "../../models/document/document";
import { AppConfigModelType } from "../../models/stores/app-config-model";
import { ProblemModelType } from "../../models/curriculum/problem";
import { NavTabSpec } from "../../models/view/nav-tabs";
import { DocumentTabPanel } from "./document-tab-panel";
import { EditableDocumentContent } from "../document/editable-document-content";
import { useAppConfigStore, useProblemStore } from "../../hooks/use-stores";

import "./document-tab-content.sass";

interface IProps {
  tabSpec: NavTabSpec;
}

export const DocumentTabContent: React.FC<IProps> = ({ tabSpec }) => {
  const [referenceDocument, setReferenceDocument] = useState<DocumentModelType | undefined>(undefined);
  const appConfigStore = useAppConfigStore();
  const problemStore = useProblemStore();

  const handleTabClick = () => {
    setReferenceDocument(undefined);
  };

  const handleSelectDocument = (document: DocumentModelType) => {
    setReferenceDocument(document);
  };

  const documentTitle = (document: DocumentModelType, appConfig: AppConfigModelType, problem: ProblemModelType) => {
    const { type } = document;
    return document.isSupport
      ? document.getProperty("caption") || "Support"
      : isProblemType(type) ? problem.title : document.getDisplayTitle(appConfig);
  };

  const sectionClass = referenceDocument?.type === "learningLog" ? "learning-log" : "";
  const documentView = referenceDocument &&
    <div>
      <div className={`document-title ${tabSpec.tab} ${sectionClass}`}>
        {documentTitle(referenceDocument, appConfigStore, problemStore)}
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
        onTabClick={handleTabClick}
        onSelectDocument={handleSelectDocument}
        documentView={documentView}
      />
    </div>
  );
};
