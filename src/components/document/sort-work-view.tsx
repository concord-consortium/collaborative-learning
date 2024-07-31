import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { useStores } from "../../hooks/use-stores";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DEBUG_DOC_LIST } from "../../lib/debug";
import { SortWorkDocumentArea } from "./sort-work-document-area";
import { ENavTab } from "../../models/view/nav-tabs";
import { DocListDebug } from "./doc-list-debug";
import { DocFilterType, PrimarySortType, SecondarySortType } from "../../models/stores/ui-types";
import { SortedSection } from "./sorted-section";
import { DocumentGroup } from "../../models/stores/document-group";


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
  const [secondarySortBy, setSecondarySortBy] = useState("None");
  const docFilter = persistentUIDocFilter;

  const handleDocFilterSelection = (filter: DocFilterType) => {
    persistentUI.setDocFilter(filter);
  };

  const handlePrimarySortBySelection = (sort: string) => {
    setPrimarySortBy(sort);
    if (sort === secondarySortBy) {
      setSecondarySortBy("None");
    }
  };

  const primarySortByOptions: ICustomDropdownItem[] = sortOptions.map((option) => ({
    disabled: false,
    selected: option === primarySortBy,
    text: option,
    onClick: () => handlePrimarySortBySelection(option)
  }));

  const secondarySortOptions: ICustomDropdownItem[] = sortOptions.map((option) => ({
    disabled: option === primarySortBy,
    selected: option === secondarySortBy,
    text: option,
    onClick: () => setSecondarySortBy(option)
  }));
  secondarySortOptions.unshift({
    disabled: false,
    selected: secondarySortBy === "None",
    text: "None",
    onClick: () => setSecondarySortBy("None")
  });

  const docFilterOptions: ICustomDropdownItem[] = filterOptions.map((option) => ({
    selected: option === docFilter,
    text: option,
    onClick: () => handleDocFilterSelection(option)
  }));

  const sortedDocumentGroups = sortedDocuments.sortBy(
    primarySortBy === sortTagPrompt ? "Strategy" : primarySortBy as PrimarySortType
  );
  const secondarySearchTerm = secondarySortBy === sortTagPrompt ? "Strategy" : secondarySortBy as SecondarySortType;
  const tabState = persistentUI.tabs.get(ENavTab.kSortWork);
  const openDocumentKey = tabState?.openDocuments.get(ENavTab.kSortWork) || "";
  const showSortWorkDocumentArea = !!openDocumentKey;

  useEffect(()=>{
    sortedDocuments.updateMetaDataDocs(docFilter, unit.code, investigation.ordinal, problem.ordinal);
  }, [docFilter, unit.code, investigation.ordinal, problem.ordinal, sortedDocuments]);

  return (
    <div key="sort-work-view" className="sort-work-view">
      {
        showSortWorkDocumentArea ?
        <SortWorkDocumentArea openDocumentKey={openDocumentKey}/> :
        <>
          <SortWorkHeader
            key={`sort-work-header-${primarySortBy}`}
            docFilter={docFilter}
            docFilterItems={docFilterOptions}
            primarySort={primarySortBy}
            primarySortItems={primarySortByOptions}
            secondarySort={secondarySortBy}
            secondarySortItems={secondarySortOptions}
          />
          <div key={primarySortBy} className="tab-panel-documents-section">
            { sortedDocumentGroups &&
              sortedDocumentGroups.map((documentGroup: DocumentGroup, idx: number) => {
                return (
                  <SortedSection
                    key={`sortedDocuments-${documentGroup.label}`}
                    docFilter={docFilter}
                    documentGroup={documentGroup}
                    idx={idx}
                    secondarySort={secondarySearchTerm}
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
