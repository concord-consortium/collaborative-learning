import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React from "react";
import { NavTabModelType } from "../../models/view/nav-tabs";

import "./sort-work-view.scss";

interface ISortProps {
  tabSpec: NavTabModelType;
}

export const SortWorkView:React.FC<ISortProps> = observer(function SortWorkView({tabSpec}){
  console.log("-----------SortWorkView----------");
  console.log("\ttabSpec:", tabSpec);
  const stores = useStores();
  const allDocuments = JSON.parse(JSON.stringify(stores.documents.all));

  return (
    <div
      key="sort-work-view"
      className="sort-work-view"
    >
      <div className="sort-work-header"/>
      <div className="sort-work-documents">
        <div className="live-problem-documents">
          {"Problem Documents (Not Published) - Include documents from all assignments"}
        </div>
        <div className="live-personal-documents">
          {"Personal Documents (Not Published)"}
        </div>



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
