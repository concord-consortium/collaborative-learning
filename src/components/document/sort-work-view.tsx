import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React from "react";
import { PersonalDocument, ProblemDocument } from "../../models/document/document-types";

import "./sort-work-view.scss";

export const SortWorkView:React.FC = observer(function SortWorkView(){
  const stores = useStores();
  const allDocuments = stores.documents.all;
  const typesToInclude = [ProblemDocument, PersonalDocument];

  return (
    <div key="sort-work-view" className="sort-work-view">
      <div className="sort-work-header">
        Header
      </div>
      <div className="sort-work-documents">
        {allDocuments.map((doc: any) => {
            return (
              <pre key={doc.key}>{doc.key} | {doc.type} | user: { doc.uid}</pre>
            );
          })}
      </div>
    </div>
  );
});
