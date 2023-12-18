import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React from "react";
import { ProblemDocument } from "../../models/document/document-types";
import { SortWorkHeader } from "../navigation/sort-work-header";

import "./sort-work-view.scss";

export const SortWorkView:React.FC = observer(function SortWorkView(){
  const stores = useStores();
  const allDocuments = stores.documents;
  const problemDocuments = allDocuments.byType(ProblemDocument);

  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader />

      {/* <DocumentCollectionList
        subTab={}
        tabSpec={myWorkTabSpec}
      /> */}

      {/* <div className="sort-work-documents">
        <div className="live-problem-documents">
          {"Problem Documents (Not Published) - Include documents from all assignments"}
          {
            problemDocuments.map((doc:any, idx: number) =>{
              console.log("problemDoc:", doc);
              return (
                <div key={`entry-${idx}`} className="entry">  {doc.key} </div>
              );
            })
          }
        </div>

        <div className="live-personal-documents">
          {"Personal Documents (Not Published)"}
        </div>

      </div> */}
    </div>
  );
});

