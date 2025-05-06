import React, { useEffect } from "react";
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

import "../thumbnail/document-type-collection.scss";
import "./sort-work-view.scss";

/**
 * Resources pane view of class work and exemplars.
 * Various options for sorting the display are available - by user, by group, by tools used, etc.
 */
export const SortWorkView: React.FC = observer(function SortWorkView() {
  const { appConfig, investigation, persistentUI, problem, sortedDocuments, ui, unit } = useStores();
  const { tagPrompt } = appConfig;
  const { docFilter: persistentUIDocFilter, primarySortBy, secondarySortBy } = persistentUI;
  const sortTagPrompt = tagPrompt || ""; //first dropdown choice for comment tags
  const sortOptions = ["Group", "Name", sortTagPrompt, "Bookmarked", "Tools"];
  const filterOptions: DocFilterType[] = ["Problem", "Investigation", "Unit", "All"];
  const docFilter = persistentUIDocFilter;

  const handleDocFilterSelection = (filter: DocFilterType) => {
    persistentUI.setDocFilter(filter);
  };

  const normalizeSortString = (sort: string) => {
    return sort === sortTagPrompt ? "Strategy" : sort;
  };

  const handlePrimarySortBySelection = (sort: string) => {
    persistentUI.setPrimarySortBy(sort);
    if (sort === secondarySortBy) {
      persistentUI.setSecondarySortBy("None");
    }
    ui.clearHighlightedSortWorkDocument();
    ui.clearExpandedSortWorkSections();
  };

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
    onClick: () => persistentUI.setSecondarySortBy(normalizeSortString(option))
  }));
  secondarySortOptions.unshift({
    disabled: false,
    selected: secondarySortBy === "None",
    text: "None",
    onClick: () => persistentUI.setSecondarySortBy("None")
  });

  const docFilterOptions: ICustomDropdownItem[] = filterOptions.map((option) => ({
    selected: option === docFilter,
    text: option,
    onClick: () => handleDocFilterSelection(option)
  }));

  const primarySearchTerm = normalizeSortString(primarySortBy) as PrimarySortType;
  const sortedDocumentGroups = sortedDocuments.sortBy(primarySearchTerm);
  const secondarySearchTerm = normalizeSortString(secondarySortBy) as SecondarySortType;
  const maybeTabState = persistentUI.tabs.get(ENavTab.kSortWork);
  const openDocumentKey = maybeTabState?.currentDocumentGroup?.primaryDocumentKey;

  const getOpenDocumentsGroup = () => {
    let openGroup;
    if (maybeTabState?.currentDocumentGroupId && openDocumentKey) {
      let openGroupMetadata: IOpenDocumentsGroupMetadata;
      try {
        // The sort work tab stores the group metadata as the document group id.
        // This way it can record both the primary and secondary filter values
        // associated with the group.
        // TODO: create different tabState and/or document group types so these
        // values can be stored as fields in the document group
        openGroupMetadata = JSON.parse(maybeTabState.currentDocumentGroupId);
      } catch (e) {
        persistentUI.closeDocumentGroupPrimaryDocument(ENavTab.kSortWork);
        return;
      }

      if (openGroupMetadata.primaryType !== primarySearchTerm) {
        persistentUI.closeDocumentGroupPrimaryDocument(ENavTab.kSortWork);
      } else {
        openGroup = sortedDocumentGroups.find(group => group.label === openGroupMetadata.primaryLabel);
        if (openGroupMetadata.secondaryType === secondarySearchTerm) {
          const secondaryGroups = openGroup?.sortBy(secondarySearchTerm);
          openGroup = secondaryGroups?.find(group => group.label === openGroupMetadata.secondaryLabel);
        }
      }
    }
    return openGroup;
  };

  const openDocumentsGroup = getOpenDocumentsGroup();
  const showSortWorkDocumentArea = !!openDocumentKey && openDocumentsGroup;

  useEffect(()=>{
    return sortedDocuments.watchFirestoreMetaDataDocs(docFilter, unit.code, investigation.ordinal, problem.ordinal);
  }, [docFilter, unit.code, investigation.ordinal, problem.ordinal, sortedDocuments]);

  return (
    <div key="sort-work-view" className="sort-work-view">
      {
        showSortWorkDocumentArea ?
          <SortWorkDocumentArea openDocumentsGroup={openDocumentsGroup} /> :
          <>
            <SortWorkHeader
              key={`sort-work-header-${primarySortBy}`}
              docFilter={docFilter}
              docFilterItems={docFilterOptions}
              primarySortItems={primarySortByOptions}
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
