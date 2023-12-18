import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React, {useState } from "react";
import { SortWorkHeader } from "../navigation/sort-work-header";

import "./sort-work-view.scss";
import { DocumentCollectionByType } from "../thumbnail/documents-type-collection";
import { ENavTab } from "../../models/view/nav-tabs";

export const SortWorkView:React.FC = observer(function SortWorkView(){
  const stores = useStores();
  const allDocuments = stores.documents.all;
  const [sortableDocs, setSortableDocs] = useState(allDocuments);

  // const subtab = "sort";
  // const tabSpec = stores.appConfig.navTabs.getNavTabSpec("sort");
  const someSectionModel = stores?.appConfig?.navTabs?.getNavTabSpec("class-work" as ENavTab)?.sections[0];
  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader />

      {/* <DocumentCollectionList
        subTab={subTab}
        tabSpec={tabSpec}
      /> */}

      <DocumentCollectionByType
        key={0}
        tab={"sort"}
        section={someSectionModel as any}
        index={0}
        horizontal={false}
        numSections={1}
        scale={1}
        selectedDocument={""}
        selectedSecondaryDocument={""}
        onDocumentDragStart={() => {}}
      />


      <hr />
      { sortableDocs.map((doc:any, idx: number) => {
        return (
          <pre style={{padding:0, margin:0}} key={idx}>
            {doc.key} | group: {doc.groupId ?? "_"} | user: {doc.uid}
          </pre>
        );
      })}

    </div>
  );
});

