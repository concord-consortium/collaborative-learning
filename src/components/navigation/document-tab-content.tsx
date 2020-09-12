import React, { useState } from "react";
import { DocumentModelType } from "../../models/document/document";
import { ContentTabSpec } from "../../models/view/left-tabs";
import { DocumentTabPanel } from "./document-tab-panel";
import { EditableDocumentContent } from "../document/editable-document-content";

import "./document-tab-content.sass";

interface IProps {
  tabSpec: ContentTabSpec;
}

export const DocumentTabContent: React.FC<IProps> = ({ tabSpec }) => {
  const [referenceDocument, setReferenceDocument] = useState<DocumentModelType | undefined>(undefined);

  const handleTabClick = () => {
    setReferenceDocument(undefined);
  };

  const handleDocumentClick = (document: DocumentModelType) => {
    setReferenceDocument(document);
  };

  const documentView = referenceDocument &&
          <EditableDocumentContent
            mode={"1-up"}
            isPrimary={false}
            document={referenceDocument}
            readOnly={true}
          />;

  return (
    <div className="document-tab-content">
      <DocumentTabPanel
        tabSpec={tabSpec}
        onTabClick={handleTabClick}
        onDocumentClick={handleDocumentClick}
        documentView={documentView}
      />
    </div>
  );
};
