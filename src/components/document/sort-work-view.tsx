import React, { useCallback, useEffect } from "react";
import { observer } from "mobx-react";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { useSortOptions } from "../../hooks/use-sort-options";
import { useStores } from "../../hooks/use-stores";
import { DEBUG_DOC_LIST } from "../../lib/debug";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { DocumentGroup } from "../../models/stores/document-group";
import { DocFilterType, DocFilterTypeIds, PrimarySortType, SecondarySortType } from "../../models/stores/ui-types";
import { ENavTab } from "../../models/view/nav-tabs";
import { translate } from "../../utilities/translation/translate";
import { AiSummary } from "../navigation/ai-summary";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { DocListDebug } from "./doc-list-debug";
import { IOpenDocumentsGroupMetadata, SortedSection } from "./sorted-section";
import { SortWorkDocumentArea } from "./sort-work-document-area";

import "../thumbnail/document-type-collection.scss";
import "./sort-work-view.scss";
import { isTranslationKey } from "../../utilities/translation/translation-types";

/**
 * Resources pane view of class work and exemplars.
 * Various options for sorting the display are available - by user, by group, by tools used, etc.
 */
export const SortWorkView: React.FC = observer(function SortWorkView() {
  const { appConfig, investigation, persistentUI, problem, sortedDocuments, ui, unit } = useStores();
  const { sortOptions, showContextFilter, defaultPrimarySort, isValidSortType } = useSortOptions();
  const { docFilter: persistentUIDocFilter, primarySortBy, secondarySortBy } = persistentUI;
  const enabledDocFilterOptions = appConfig.sortWorkConfig?.docFilterOptions;
  const filterOptions: DocFilterType[] = enabledDocFilterOptions ? [...enabledDocFilterOptions] : [...DocFilterTypeIds];
  const docFilter = persistentUIDocFilter;

  // Validate that current sort selections are still valid given configuration
  const validatedPrimarySortBy: PrimarySortType =
    isValidSortType(primarySortBy) ? primarySortBy : defaultPrimarySort;
  const validatedSecondarySortBy: SecondarySortType =
    secondarySortBy === "None" || isValidSortType(secondarySortBy) ? secondarySortBy : "None";

  useEffect(() => {
    if (validatedPrimarySortBy !== primarySortBy) {
      persistentUI.setPrimarySortBy(validatedPrimarySortBy);
    }
    if (validatedSecondarySortBy !== secondarySortBy) {
      persistentUI.setSecondarySortBy(validatedSecondarySortBy);
    }
  }, [validatedPrimarySortBy, validatedSecondarySortBy, primarySortBy, secondarySortBy, persistentUI]);

  const handleDocFilterSelection = useCallback((filter: DocFilterType) => {
    Logger.log(LogEventName.SORT_SCOPE_CHANGE, {old: docFilter, new: filter});
    persistentUI.setDocFilter(filter);
  }, [docFilter, persistentUI]);

  const handlePrimarySortBySelection = useCallback((sort: PrimarySortType) => {
    Logger.log(LogEventName.FIRST_SORT_CHANGE, {old: validatedPrimarySortBy, new: sort});
    persistentUI.setPrimarySortBy(sort);

    if (sort === validatedSecondarySortBy) {
      // call directly to avoid logging SECOND_SORT_CHANGE
      persistentUI.setSecondarySortBy("None");
    }

    if (sort === "Problem" && docFilter === "Problem") {
      persistentUI.setDocFilter("Investigation");
    }

    ui.clearHighlightedSortWorkDocument();
    ui.clearExpandedSortWorkSections();
  }, [persistentUI, validatedPrimarySortBy, validatedSecondarySortBy, docFilter, ui]);

  const handleSecondarySortBySelection = useCallback((sort: SecondarySortType) => {
    Logger.log(LogEventName.SECOND_SORT_CHANGE, {old: validatedSecondarySortBy, new: sort});
    persistentUI.setSecondarySortBy(sort);
  }, [persistentUI, validatedSecondarySortBy]);

  const primarySortByOptions: ICustomDropdownItem[] = sortOptions.map((option) => ({
    disabled: false,
    id: option.type.toLowerCase(),
    selected: option.type === validatedPrimarySortBy,
    text: option.label,
    onClick: () => handlePrimarySortBySelection(option.type)
  }));

  const secondarySortByOptions: ICustomDropdownItem[] = sortOptions.map((option) => ({
    disabled: option.type === validatedPrimarySortBy,
    id: option.type.toLowerCase(),
    selected: option.type === validatedSecondarySortBy,
    text: option.label,
    onClick: () => handleSecondarySortBySelection(option.type)
  }));
  secondarySortByOptions.unshift({
    disabled: false,
    id: "none",
    selected: validatedSecondarySortBy === "None",
    text: "None",
    onClick: () => handleSecondarySortBySelection("None")
  });

  // Disable "Problem" filter option when sorting by Problem
  const docFilterOptions: ICustomDropdownItem[] = filterOptions.map((option) => ({
    disabled: option === "Problem" && validatedPrimarySortBy === "Problem",
    selected: option === docFilter,
    text: isTranslationKey(option) ? translate(option) : option,
    onClick: () => handleDocFilterSelection(option)
  }));

  const sortedDocumentGroups = sortedDocuments.sortBy(validatedPrimarySortBy);
  const secondarySearchTerm = validatedSecondarySortBy;
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
      if (openGroupMetadata.primaryType !== validatedPrimarySortBy) {
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
              key={`sort-work-header-${validatedPrimarySortBy}`}
              docFilter={docFilter}
              docFilterItems={docFilterOptions}
              primarySortItems={primarySortByOptions}
              secondarySortItems={secondarySortByOptions}
              showContextFilter={showContextFilter}
            />
            <AiSummary />
            <div key={validatedPrimarySortBy} className="tab-panel-documents-section">
              { sortedDocumentGroups &&
                sortedDocumentGroups.map((documentGroup: DocumentGroup, idx: number) => {
                  return (
                    <SortedSection
                      key={`sortedDocuments-${documentGroup.label}`}
                      docFilter={docFilter}
                      documentGroup={documentGroup}
                      idx={idx}
                      secondarySort={secondarySearchTerm}
                      primarySortBy={validatedPrimarySortBy}
                      secondarySortBy={validatedSecondarySortBy}
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
