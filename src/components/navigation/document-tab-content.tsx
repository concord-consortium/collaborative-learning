import React, { useState } from "react";
import { DocumentModelType } from "../../models/document/document";
import { LeftTabSpec } from "../../models/view/left-tabs";
import { DocumentTabPanel } from "./document-tab-panel";

import "./document-tab-content.sass";

interface IProps {
  tabSpec: LeftTabSpec;
}

export const DocumentTabContent: React.FC<IProps> = ({ tabSpec }) => {
  const [referenceDocument, setReferenceDocument] = useState<DocumentModelType | undefined>(undefined);

  const handleTabClick = () => {
    setReferenceDocument(undefined);
  };

  const handleDocumentClick = (document: DocumentModelType) => {
    setReferenceDocument(document);
  };

  return (
    <div className="document-tab-content">
      <DocumentTabPanel
        tabSpec={tabSpec}
        onTabClick={handleTabClick}
        onDocumentClick={handleDocumentClick}
        document={referenceDocument}
      />
    </div>
  );
};
