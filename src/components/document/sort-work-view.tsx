import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { useStores } from "../../hooks/use-stores";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DEBUG_DOC_LIST } from "../../lib/debug";
import { SortWorkDocumentArea } from "./sort-work-document-area";
import { ENavTab } from "../../models/view/nav-tabs";
import { DocListDebug } from "./doc-list-debug";
import { DocFilterType } from "../../models/stores/ui-types";
import { SortedDocuments } from "./sorted-documents";

import "../thumbnail/document-type-collection.scss";
/**
 * Resources pane view of class work and exemplars.
 * Various options for sorting the display are available - by user, by group, by tools used, etc.
 */
export const SortWorkView: React.FC = observer(function SortWorkView() {
  const { appConfig, investigation, persistentUI, problem, sortedDocuments, unit } = useStores();
  const { tagPrompt } = appConfig;
  const { docFilter: persistentUIDocFilter } = persistentUI;
  const sortTagPrompt = tagPrompt || ""; //first dropdown choice for comment tags
  const sortOptions = ["Group", "Name", sortTagPrompt, "Bookmarked", "Tools"];
  const filterOptions: DocFilterType[] = ["Problem", "Investigation", "Unit", "All"];
  const [primarySortBy, setPrimarySortBy] = useState("Group");
  const [secondarySortBy, setSecondarySortBy] = useState("Name");
  const docFilter = persistentUIDocFilter;

  const handleDocFilterSelection = (filter: DocFilterType) => {
    persistentUI.setDocFilter(filter);
  };

  useEffect(()=>{
    sortedDocuments.updateMetaDataDocs(docFilter, unit.code, investigation.ordinal, problem.ordinal);
  }, [docFilter, unit.code, investigation.ordinal, problem.ordinal, sortedDocuments]);

  const primarySortByOptions: ICustomDropdownItem[] = sortOptions.map((option) => ({
    text: option,
    onClick: () => setPrimarySortBy(option)
  }));

  const secondarySortOptions: ICustomDropdownItem[] = sortOptions.map((option) => ({
    text: option,
    onClick: () => setSecondarySortBy(option)
  }));

  const docFilterOptions: ICustomDropdownItem[] = filterOptions.map((option) => ({
    selected: option === docFilter,
    text: option,
    onClick: () => handleDocFilterSelection(option)
  }));

  const primarySearchTerm = primarySortBy === sortTagPrompt ? "Strategy" : primarySortBy;
  const secondarySearchTerm = secondarySortBy === sortTagPrompt ? "Strategy" : secondarySortBy;
  const renderedSortedDocuments = sortedDocuments.sortDocuments(primarySearchTerm, secondarySearchTerm);

  const tabState = persistentUI.tabs.get(ENavTab.kSortWork);
  const openDocumentKey = tabState?.openDocuments.get(ENavTab.kSortWork) || "";
  const showSortWorkDocumentArea = !!openDocumentKey;

  return (
    <div key="sort-work-view" className="sort-work-view">
      {
        showSortWorkDocumentArea ?
        <SortWorkDocumentArea openDocumentKey={openDocumentKey}/> :
        <>
          <SortWorkHeader
            docFilter={docFilter}
            docFilterItems={docFilterOptions}
            primarySort={primarySortBy}
            primarySortItems={primarySortByOptions}
            secondarySort={secondarySortBy}
            secondarySortItems={secondarySortOptions}
          />
          <div key={primarySortBy} className="tab-panel-documents-section">
            { renderedSortedDocuments &&
              renderedSortedDocuments.map((sortedSection, idx) => {
                return (
                  <SortedDocuments
                    key={`sortedDocuments-${idx}`}
                    docFilter={docFilter}
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
