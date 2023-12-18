import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React from "react";
import { SortWorkHeader } from "../navigation/sort-work-header";

import "./sort-work-view.scss";
import { DocumentCollectionByType } from "../thumbnail/documents-type-collection";
import { ENavTab } from "../../models/view/nav-tabs";

export const SortWorkView:React.FC = observer(function SortWorkView(){
  const stores = useStores();
  const allDocuments = stores.documents.all;
  const sectionModelToGetRidOf = stores?.appConfig?.navTabs?.getNavTabSpec(ENavTab.kSortWork)?.sections[0];

  /*
     modelling after DocumentCollectionByType (documents-type-collection.tsx):
     map out to a flat array all the docs from each group render those
     from stores you have the groups, you have the users

     when you open a document -- there are handlers for that that you will need to
     be able to pass down - selectedDocument

     so look for that some like handleSelectedDocument something - whatever does the opening on click
     onSelectDocument...
  */

  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader />

      {/* This is going to go away, but is a cousin of how we'll render thumbnails,
      see note in DocumentCollectionByType */}
      <DocumentCollectionByType
        key={0}
        tab={"sort"}
        section={sectionModelToGetRidOf as any}
        index={0}
        horizontal={false}
        numSections={1}
        scale={1}
        selectedDocument={""}
        selectedSecondaryDocument={""}
        onDocumentDragStart={() => {}}
      />

      {/* This is going to go away, but for now lets us see documents in store */}
      { allDocuments.map((doc:any, idx: number) => {
        return (
          <pre style={{padding:0, margin:0}} key={idx}>
            {doc.key} | group: {doc.groupId ?? "_"} | user: {doc.uid}
          </pre>
        );
      })}

    </div>
  );
});

