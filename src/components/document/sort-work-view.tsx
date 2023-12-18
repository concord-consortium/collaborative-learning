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
  const someSectionModel = stores?.appConfig?.navTabs?.getNavTabSpec(ENavTab.kSortWork)?.sections[0];

  console.log("ZZZ someSectionModel:", someSectionModel);
  // const someSectionModel = {
  //   "className": "",
  //   "title": "Workspaces",
  //   "type": "published-problem-documents",
  //   "dataTestHeader": "class-work-section-published",
  //   "dataTestItem": "class-work-list-items",
  //   "documentTypes": [
  //     "publication"
  //   ],
  //   "order": "reverse",
  //   "properties": [
  //     "!isTeacherDocument"
  //   ],
  //   "showStars": [
  //     "teacher"
  //   ],
  //   "showGroupWorkspaces": false,
  //   "addDocument": false
  // };

  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader />

      {/* <DocumentCollectionList
        subTab={subTab}
        tabSpec={tabSpec}
      /> */}
      some section model:  <pre>{JSON.stringify(someSectionModel, null, 2)}</pre>
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

