import React, { useCallback, useEffect } from "react";
import { observer } from "mobx-react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { useStores } from "../../hooks/use-stores";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DEBUG_DOC_LIST } from "../../lib/debug";
import { SortWorkDocumentArea } from "./sort-work-document-area";
import { ENavTab } from "../../models/view/nav-tabs";
import { DocListDebug } from "./doc-list-debug";
import { DocFilterType, PrimarySortType, SecondarySortType } from "../../models/stores/ui-types";
import { IOpenDocumentsGroupMetadata, SortedSection } from "./sorted-section";
import { DocumentGroup } from "../../models/stores/document-group";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { AiSummary } from "../navigation/ai-summary";

import "../thumbnail/document-type-collection.scss";
import "./sort-work-view.scss";

interface FilterOption {
  label: string;
  value: DocFilterType;
}

/**
 * Resources pane view of class work and exemplars.
 * Various options for sorting the display are available - by user, by group, by tools used, etc.
 */
export const SortWorkView: React.FC = observer(function SortWorkView() {
  const { appConfig, investigation, persistentUI, problem, sortedDocuments, ui, unit } = useStores();
  const { getProblemHierarchyLabel, tagPrompt } = appConfig;
  const { docFilter: persistentUIDocFilter, primarySortBy, secondarySortBy } = persistentUI;
  const sortTagPrompt = tagPrompt || ""; //first dropdown choice for comment tags
  const sortOptions = ["Date", "Group", "Name", sortTagPrompt, "Bookmarked", "Tools"];
  const filterOptions: FilterOption[] = [
    { label: getProblemHierarchyLabel("Problem", 1), value: "Problem" },
    { label: getProblemHierarchyLabel("Investigation", 1), value: "Investigation" },
    { label: getProblemHierarchyLabel("Unit", 1), value: "Unit" },
    { label: "All", value: "All" }
  ];
  const docFilter = persistentUIDocFilter;
  const docFilterLabel = getProblemHierarchyLabel(docFilter, 1);

  const handleDocFilterSelection = useCallback((filter: DocFilterType) => {
    Logger.log(LogEventName.SORT_SCOPE_CHANGE, {old: docFilter, new: filter});
    persistentUI.setDocFilter(filter);
  }, [docFilter, persistentUI]);

  const normalizeSortString = (sort: string) => {
    return sort === sortTagPrompt ? "Strategy" : sort;
  };

  const handlePrimarySortBySelection = useCallback((sort: string) => {
    Logger.log(LogEventName.FIRST_SORT_CHANGE, {old: primarySortBy, new: sort});
    persistentUI.setPrimarySortBy(sort);
    if (sort === secondarySortBy) {
      // call directly to avoid logging SECOND_SORT_CHANGE
      persistentUI.setSecondarySortBy("None");
    }
    ui.clearHighlightedSortWorkDocument();
    ui.clearExpandedSortWorkSections();
  }, [persistentUI, primarySortBy, secondarySortBy, ui]);

  const handleSecondarySortBySelection = useCallback((sort: string) => {
    Logger.log(LogEventName.SECOND_SORT_CHANGE, {old: secondarySortBy, new: sort});
    persistentUI.setSecondarySortBy(sort);
  }, [persistentUI, secondarySortBy]);

  const primarySortByOptions: ICustomDropdownItem[] = sortOptions.map((option) => ({
    disabled: false,
    id: normalizeSortString(option).toLowerCase(),
    selected: normalizeSortString(option) === primarySortBy,
    text: option,
    onClick: () => handlePrimarySortBySelection(normalizeSortString(option))
  }));

  const secondarySortOptions: ICustomDropdownItem[] = sortOptions.map((option) => ({
    disabled: option === primarySortBy,
    id: normalizeSortString(option).toLowerCase(),
    selected: normalizeSortString(option) === secondarySortBy,
    text: option,
    onClick: () => handleSecondarySortBySelection(normalizeSortString(option))
  }));
  secondarySortOptions.unshift({
    disabled: false,
    selected: secondarySortBy === "None",
    text: "None",
    onClick: () => handleSecondarySortBySelection("None")
  });

  const docFilterOptions: ICustomDropdownItem[] = filterOptions.map(({ label, value }) => ({
    selected: value === docFilter,
    text: label,
    onClick: () => handleDocFilterSelection(value)
  }));

  const primarySearchTerm = normalizeSortString(primarySortBy) as PrimarySortType;
  const sortedDocumentGroups = sortedDocuments.sortBy(primarySearchTerm);
  const secondarySearchTerm = normalizeSortString(secondarySortBy) as SecondarySortType;
  const maybeTabState = persistentUI.tabs.get(ENavTab.kSortWork);
  const openDocumentKey = maybeTabState?.currentDocumentGroup?.primaryDocumentKey;

  let openGroupMetadata: IOpenDocumentsGroupMetadata|undefined;
  let openDocumentsGroup: DocumentGroup|undefined;
  let previousDocumentsGroup: DocumentGroup|undefined;
  let nextDocumentsGroup: DocumentGroup|undefined;
  if (maybeTabState?.currentDocumentGroupId && openDocumentKey) {
    try {
      // The sort work tab stores the group metadata as the document group id.
      // This way it can record both the primary and secondary filter values
      // associated with the group.
      // TODO: create different tabState and/or document group types so these
      // values can be stored as fields in the document group
      openGroupMetadata = JSON.parse(maybeTabState.currentDocumentGroupId);
    } catch (e) {
      persistentUI.closeDocumentGroupPrimaryDocument(ENavTab.kSortWork);
    }

    if (openGroupMetadata) {
      if (openGroupMetadata.primaryType !== primarySearchTerm) {
        persistentUI.closeDocumentGroupPrimaryDocument(ENavTab.kSortWork);
      } else {
        const openDocumentsGroupIndex =
          sortedDocumentGroups.findIndex(group => group.label === openGroupMetadata?.primaryLabel);
        openDocumentsGroup = sortedDocumentGroups[openDocumentsGroupIndex];
        if (openGroupMetadata.secondaryType === secondarySearchTerm) {
          const secondaryGroups = openDocumentsGroup?.sortBy(secondarySearchTerm) || [];
          const groupsWithDocs = secondaryGroups.filter(group => group.documents.length > 0);
          const secondaryGroupIndex =
            groupsWithDocs.findIndex(group => group.label === openGroupMetadata?.secondaryLabel);
          openDocumentsGroup = groupsWithDocs[secondaryGroupIndex];
          const numGroups = groupsWithDocs.length;
          if (numGroups > 1) {
            previousDocumentsGroup = groupsWithDocs[(secondaryGroupIndex - 1 + numGroups) % numGroups];
            nextDocumentsGroup = groupsWithDocs[(secondaryGroupIndex + 1) % numGroups];
          }
        } else {
          const groupsWithDocs = sortedDocumentGroups.filter(group => group.documents.length > 0);
          const numGroups = groupsWithDocs.length;
          if (numGroups > 1) {
            previousDocumentsGroup = groupsWithDocs[(openDocumentsGroupIndex - 1 + numGroups) % numGroups];
            nextDocumentsGroup = groupsWithDocs[(openDocumentsGroupIndex + 1) % numGroups];
          }
        }
      }
    }
  }
  const showSortWorkDocumentArea = !!openDocumentKey && openDocumentsGroup;

  useEffect(()=>{
    return sortedDocuments.watchFirestoreMetaDataDocs(docFilter, unit.code, investigation.ordinal, problem.ordinal);
  }, [docFilter, unit.code, investigation.ordinal, problem.ordinal, sortedDocuments]);

  return (
    <div key="sort-work-view" className="sort-work-view">
      {
        showSortWorkDocumentArea ?
          openDocumentsGroup && (
            <SortWorkDocumentArea
              nextDocumentsGroup={nextDocumentsGroup}
              openDocumentsGroup={openDocumentsGroup}
              openDocumentKey={openDocumentKey}
              openGroupMetadata={openGroupMetadata}
              previousDocumentsGroup={previousDocumentsGroup}
            />
          ) :
          <>
            <SortWorkHeader
              key={`sort-work-header-${primarySortBy}`}
              docFilterLabel={docFilterLabel}
              docFilterItems={docFilterOptions}
              primarySortItems={primarySortByOptions}
              secondarySortItems={secondarySortOptions}
            />
            <AiSummary />
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
                      primarySortBy={primarySortBy}
                      secondarySortBy={secondarySortBy}
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
