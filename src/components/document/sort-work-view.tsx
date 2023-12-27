import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React, { useState } from "react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { DocumentContextReact } from "./document-context";
import { DEBUG_SORT_WORK } from "../../lib/debug";
import { isSortableType } from "../../models/document/document-types";

import "../thumbnail/document-type-collection.sass";
import "./sort-work-view.scss";

export const SortWorkView:React.FC = observer(function SortWorkView(){
  const sortOptions = ["Group", "Student"];
  const stores = useStores();

  const [sortBy, setSortBy] = useState("Group");

  const filteredDocsByType = stores.documents.all.filter((doc:DocumentModelType) => {
    return isSortableType(doc.type);
  });

  const groups = stores.groups;

  console.log("\t🥩 groups:", groups);

  const sortByOptions: ICustomDropdownItem[] = sortOptions.map((option)=>({
    text: option,
    onClick: () => setSortBy(option)
  }));

  const renderDebugView = () => {
    return filteredDocsByType.map((doc, idx: number) => {
      const ct = idx + 1;
      return (
        <pre key={idx} style={{margin:"0px", padding: "0px", fontSize: "10px"}}>
          {ct < 10 && " "}{ct} | {doc.title?.slice(0, 20) || "                    "}
          | {doc.key} | {doc.type} | {doc.uid}
        </pre>
      );
    });
  };

  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader sortBy={sortBy} sortByOptions={sortByOptions} />
      <div className="documents-panel">
        <div className={"tab-panel-documents-section"}>
          { DEBUG_SORT_WORK && renderDebugView()}
          <div className={"list"}>
            {
              filteredDocsByType.map((doc:DocumentModelType, idx: number) => {
                const documentContext = getDocumentContext(doc);
                return (
                  <DocumentContextReact.Provider key={doc.key} value={documentContext}>
                    <DecoratedDocumentThumbnailItem
                      key={doc.key}
                      scale={0.1}
                      document={doc}
                      tab={"sort-work"}
                      shouldHandleStarClick={true}
                      allowDelete={false}
                    />
                  </DocumentContextReact.Provider>
                );
              })
            }
          </div>
        </div>
      </div>
    </div>
  );
});
