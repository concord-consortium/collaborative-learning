import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { useStores } from "../../hooks/use-stores";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DEBUG_DOC_LIST } from "../../lib/debug";
import { SortWorkDocumentArea } from "./sort-work-document-area";
import { ENavTab } from "../../models/view/nav-tabs";
import { DocListDebug } from "./doc-list-debug";
import { SortedDocuments } from "./sorted-documents";

import "../thumbnail/document-type-collection.scss";
/**
 * Resources pane view of class work and exemplars.
 * Various options for sorting the display are available - by user, by group, by tools used, etc.
 */
export const SortWorkView: React.FC = observer(function SortWorkView() {
  const { appConfig, persistentUI, sortedDocuments } = useStores();

  //*************************** Determine Sort Options & State  ***********************************
  const {tagPrompt} = appConfig;
  const sortTagPrompt = tagPrompt || ""; //first dropdown choice for comment tags
  const sortOptions = ["Group", "Name", sortTagPrompt, "Bookmarked", "Tools"];
  const [sortBy, setSortBy] = useState("Group");

  useEffect(()=>{
    if (sortBy === sortTagPrompt){
      sortedDocuments.updateTagDocumentMap();
    }
  },[sortedDocuments, sortBy, sortTagPrompt]);

  const sortByOptions: ICustomDropdownItem[] = sortOptions.map((option) => ({
    text: option,
    onClick: () => setSortBy(option)
  }));

  let renderedSortedDocuments;
  switch (sortBy) {
    case "Group":
      renderedSortedDocuments = sortedDocuments.sortByGroup;
      break;
    case "Name":
      renderedSortedDocuments = sortedDocuments.sortByName;
      break;
    case sortTagPrompt: //Sort by Strategy
      renderedSortedDocuments = sortedDocuments.sortByStrategy;
      break;
    case "Bookmarked":
      renderedSortedDocuments = sortedDocuments.sortByBookmarks;
      break;
    case "Tools":
      renderedSortedDocuments = sortedDocuments.sortByTools;
      break;
  }

  const tabState = persistentUI.tabs.get(ENavTab.kSortWork);
  const openDocumentKey = tabState?.openDocuments.get(ENavTab.kSortWork) || "";
  const showSortWorkDocumentArea = !!openDocumentKey;

  return (
    <div key="sort-work-view" className="sort-work-view">
      {
        showSortWorkDocumentArea ?
        <SortWorkDocumentArea openDocumentKey={openDocumentKey}/> :
        <>
          <SortWorkHeader sortBy={sortBy} sortByOptions={sortByOptions} />
          <div key={sortBy} className="tab-panel-documents-section">
            { renderedSortedDocuments &&
              renderedSortedDocuments.map((sortedSection, idx) => {
                return (
                  <SortedDocuments
                    key={`sortedDocuments-${idx}`}
                    idx={idx}
                    sortedSection={sortedSection}
                  />
                );
              })
            }
            {DEBUG_DOC_LIST && <DocListDebug docs={sortedDocuments.filteredDocsByType} />}
          </div>
        </>
      }
    </div>
  );
});
