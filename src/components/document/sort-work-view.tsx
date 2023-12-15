import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React from "react";

import "./sort-work-view.scss";

export const SortWorkView:React.FC = observer(function SortWorkView(){
  const stores = useStores();
  const allDocuments = JSON.parse(JSON.stringify(stores.documents.all));

  return (
    <div
      key="sort-work-view"
      className="sort-work-view"
    >
      <div className="sort-work-header"/>
      <div className="sort-work-documents">

      </div>
        {allDocuments.map((doc: any) => {
          return (
            <li key={doc.key}>{doc.key} | {doc.type} | pubCount: {doc.properties.pubCount } | user: { doc.uid} </li>
          );
        })}
    </div>
  );
});
