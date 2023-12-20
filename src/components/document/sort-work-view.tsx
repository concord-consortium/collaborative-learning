import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React, { useEffect, useState } from "react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { ENavTab } from "../../models/view/nav-tabs";
import { getDocumentContext } from "../../models/document/document";
import { DocumentContextReact } from "./document-context";

import "./sort-work-view.scss";


const getGroupsOfDocuments = (documents: any[], sortBy: string) => {
  const groupLabel = () => {
    if (sortBy === "group"){
      // who is the user that owns the document?
      // what group are they in on the problem we are on now? (thats in groups.store)
      // THAT is the group that we will place this document in (NOT the group found in doc.groupId)
    }
    if (sortBy === "name"){
      //...
    }
  };

  /* return
  [
    {
      groupLabel: "2" | "Bob Smith", (depending on sortBy)
      groupKey: <unique>
      documents: [
        { actualDocumentObj from store },
        { actualDocumentObj from store },
        { actualDocumentObj from store }
      ]
    }
  ]
  */
};

export const SortWorkView:React.FC = observer(function SortWorkView(){
  const sortOptions = ["Group", "Student"];
  const stores = useStores();
  const [sortBy, setSortBy] = useState("Group");
  // const [sortedAll, setSortedAll] = useState<any[]>(stores.documents.all);
  const sectionModelToGetRidOf = stores?.appConfig?.navTabs?.getNavTabSpec(ENavTab.kSortWork)?.sections[0];

  const problemAndPersonalDocs = stores.documents.all; //TODO: filter out published and...look in story

  const sortByOptions: ICustomDropdownItem[] = sortOptions.map((option)=>({
    text: option,
    onClick: () => setSortBy(option)
  }));

  useEffect(() => {
    // TODO: implement the sort
    console.log("| sort by: ", sortBy);
   }, [sortBy]);

  // TODO: real calculation of this boolean
  // The section config is the source of this truth on other paths
  const shouldHandleStarClick = true;

  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader sortBy={sortBy} sortByOptions={sortByOptions} />

      <div className="documents-panel">

        {/* const groups = getGroupsOfDocuments(docs, sortBy) */}
        {/* for each group: <SortedDocsGroup> which would be one of the below per group */}

        {/* or do it inline
          for each group
              groupcomponent
                foreach document
                    thumbnail
        */}

        {
          stores.documents.all.map((doc:any, idx: number) => {
            const documentContext = getDocumentContext(doc);
            return (
              <DocumentContextReact.Provider key={doc.key} value={documentContext}>
                <pre style={{padding: "0px", margin: "0px", fontSize: "9px"}}>{ doc.key }</pre>
                <DecoratedDocumentThumbnailItem
                  key={doc.key}
                  scale={0.1}
                  section={sectionModelToGetRidOf as any} // TODO : refactor so not required
                  document={doc}
                  tab={'sort-work'}
                  shouldHandleStarClick={shouldHandleStarClick ?? false}
                />
              </DocumentContextReact.Provider>
            );
          })
        }

      </div>
    </div>
  );
});
