import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React, { useEffect, useState, useRef } from "react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { DocumentCollectionByType } from "../thumbnail/documents-type-collection";
import { ENavTab } from "../../models/view/nav-tabs";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { IObservableArray, observable } from "mobx";
import { DocumentsModelType } from "../../models/stores/documents";

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

  /* ============================ [ Sort - Filters / Options / Handlers]  ============================== */
  const [selectedFilters, setSelectedFilters] = useState(["Group", "All"]); //holds both selection option one and two

  const firstFilterOptions = ["Group", "Student"];
  const secondFilterOptions = ["All", "Test-1", "Test-2"];
  const firstFilterItems: ICustomDropdownItem[] = firstFilterOptions.map((option)=>({
    text: option,
    onClick: () => handleSetSelectedFilters(0, option)
  }));

  const secondFilterItems: ICustomDropdownItem[] = secondFilterOptions.map((option)=>({
    text: option,
    onClick: () => handleSetSelectedFilters(1, option)
  }));

  const handleSetSelectedFilters = (index: number, filterOption: string) => {
    setSelectedFilters(prevOptions => {
      const updatedOptions = [...prevOptions];
      updatedOptions[index] = filterOption; // Update the specific index with the new value
      return updatedOptions;
    });
  };

  /* ============================ [ Filter Documents based on Sort Conditions ]  ============================== */
  const [filteredSortedDocs, setFilteredSortedDocs] = useState<DocumentsModelType[]>([]);
  useEffect(() => {
    console.log("originalDocs:", allDocuments);

    const filteredDocs = allDocuments.filter(doc => doc.groupId !== undefined); //remove teachers

    if (selectedFilters[0] === "Group") {
      const sortedDocs = sortByGroup(filteredDocs);
      setFilteredSortedDocs(sortedDocs);
    } else { //
      // setFilteredSortedDocs(filteredDocs);
    }
  }, [selectedFilters, allDocuments]);

  // Sorts
  const sortByGroup = (docs: any) => {
    const groupIds = docs.map((doc: any) => doc.groupId);
    const uniqueGroupIds = new Set(groupIds);
    const sortedUniqueGroupIds = Array.from(uniqueGroupIds).sort((a: any, b: any) => a - b);

    const sortedDocs = sortedUniqueGroupIds.flatMap(
      groupId => docs.filter((doc: any) => doc.groupId === groupId)
    );
    console.log("sortedDocs:", sortedDocs);
    return sortedDocs;
  };


  /* ============================ [ Filter by Group ]  ============================== */



  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader
        firstOptionItems={firstFilterItems}
        secondOptionItems={secondFilterItems}
        selectedOptions={selectedFilters}
      />
      <div className="sort-work-documents">
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



        ------------------------- All Documents ----------------------------
        {/* This is going to go away, but for now lets us see documents in store */}
        {
          allDocuments.map((doc:any, idx: number) => {
            return (
              <div style={{padding:0, margin:0}} key={`${doc.key-idx}`}>
                {doc.key} | group: {doc.groupId ?? "_"} | user: {doc.uid}
              </div>
            );
          })
        }

        ----------------------------- Filtered -------------------------------------
        {
          filteredSortedDocs.map((doc: any, idx: number) => {
            return (
              <div className={"sort-divider"} key={`${doc.key}-${idx}-filtered`}> {/* Make sure to use unique keys */}
                <div className={"sort-document"}>
                  {doc.key} | group: {doc.groupId ?? "_"} | user: {doc.uid}
                </div>
              </div>
            );
          })
        }

      </div>
    </div>
  );
});

