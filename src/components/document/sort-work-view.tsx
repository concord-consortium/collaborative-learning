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

        <ul>
          <li>These are documents already in the store by default</li>
          <li>The next step will be to gain access to all of them - getting them in the store first</li>
          <li>So that - getting the correct keys in the store, will probably happen elsewhere</li>
          <li>Then we can start to sort them</li>
        </ul>
        {allDocuments.map((doc: any) => {
          return (
            <li key={doc.key}>{doc.key} | {doc.type} | pubCount: {doc.properties.pubCount } | user: { doc.uid} </li>
          );
        })}


    </div>
  );
});
