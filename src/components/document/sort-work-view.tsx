import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React, { useState } from "react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { getDocumentContext } from "../../models/document/document";
import { DocumentContextReact } from "./document-context";

import "../thumbnail/document-type-collection.sass";
import "./sort-work-view.scss";

export const SortWorkView:React.FC = observer(function SortWorkView(){
  const sortOptions = ["Group", "Student"];
  const stores = useStores();
  const [sortBy, setSortBy] = useState("Group");

  const sortByOptions: ICustomDropdownItem[] = sortOptions.map((option)=>({
    text: option,
    onClick: () => setSortBy(option)
  }));

  const shouldHandleStarClick = true;

  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader sortBy={sortBy} sortByOptions={sortByOptions} />
      <div className="documents-panel">
        <div className={"tab-panel-documents-section"}>
          <div className={"list"}>
            {
              stores.documents.all.map((doc:any, idx: number) => {
                const documentContext = getDocumentContext(doc);
                return (
                  <DocumentContextReact.Provider key={doc.key} value={documentContext}>
                    <DecoratedDocumentThumbnailItem
                      key={doc.key}
                      scale={0.1}
                      document={doc}
                      tab={'sort-work'}
                      shouldHandleStarClick={shouldHandleStarClick}
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
