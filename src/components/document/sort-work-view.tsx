import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React, { useState } from "react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { DocumentCollectionByType } from "../thumbnail/documents-type-collection";
import { ENavTab } from "../../models/view/nav-tabs";
import { ICustomDropdownItem } from "../../clue/components/custom-select";

import "./sort-work-view.scss";

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

  /* ============================ [ Sort - State / Options / Handlers]  ============================== */
  const [selectedFilters, setSelectedFilters] = useState(["Group", "All"]); //holds both selection option one and two

  const firstFilterOptions = ["Group", "Student"];
  const secondFilterOptions = ["All", "Test-1", "Test-2"];
  const firstFilterItems: ICustomDropdownItem[] = firstFilterOptions.map((option)=>({
    text: option,
    onClick: () => handleChangeSelectedFilters(0, option)
  }));

  const secondFilterItems: ICustomDropdownItem[] = secondFilterOptions.map((option)=>({
    text: option,
    onClick: () => handleChangeSelectedFilters(1, option)
  }));

  const handleChangeSelectedFilters = (index: number, sortByStr: string) => {
    setSelectedFilters(prevOptions => {
      const updatedOptions = [...prevOptions];
      updatedOptions[index] = sortByStr; // Update the specific index with the new value
      console.log("Updated state is:", updatedOptions);
      return updatedOptions;
    });
  };

  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader
        firstOptionItems={firstFilterItems}
        secondOptionItems={secondFilterItems}
        selectedOptions={selectedFilters}
      />

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

