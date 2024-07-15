import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { useStores } from "../../hooks/use-stores";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { DocumentContextReact } from "./document-context";
import { DEBUG_DOC_LIST } from "../../lib/debug";
import { SortWorkDocumentArea } from "./sort-work-document-area";
import { ENavTab } from "../../models/view/nav-tabs";
import { DocListDebug } from "./doc-list-debug";
import { logDocumentViewEvent } from "../../models/document/log-document-event";
import { SimpleDocumentItem } from "../thumbnail/simple-document-item";
import { DocFilterType } from "../../models/stores/ui-types";

import "../thumbnail/document-type-collection.scss";
import "./sort-work-view.scss";

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
  const [sortBy, setSortBy] = useState("Group");
  const [docFilter, setDocFilter] = useState(persistentUIDocFilter);

  const handleDocFilterSelection = (filter: DocFilterType) => {
    sortedDocuments.setDocFilter(filter);
    persistentUI.setDocFilter(filter);
    setDocFilter(filter);
  };

  useEffect(()=>{
    sortedDocuments.setDocFilter(docFilter);
    if (sortBy === sortTagPrompt){
      sortedDocuments.updateTagDocumentMap();
    }
    sortedDocuments.updateMetaDataDocs(docFilter, unit.code, investigation.ordinal, problem.ordinal);
  },[sortedDocuments, sortBy, sortTagPrompt, docFilter, investigation, unit, problem]);

  const primarySortItems: ICustomDropdownItem[] = sortOptions.map((option) => ({
    selected: option === sortBy,
    text: option,
    onClick: () => setSortBy(option)
  }));

  const filterItems: ICustomDropdownItem[] = filterOptions.map((option) => ({
    selected: option === docFilter,
    text: option,
    onClick: () => handleDocFilterSelection(option)
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

  const handleSelectDocument = (document: DocumentModelType) => {
    persistentUI.openSubTabDocument(ENavTab.kSortWork, ENavTab.kSortWork, document.key);
    logDocumentViewEvent(document);
  };

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
            filter={docFilter}
            filterItems={filterItems}
            primarySort={sortBy}
            primarySortItems={primarySortItems}
          />
          <div key={sortBy} className="tab-panel-documents-section">
            { renderedSortedDocuments &&
              renderedSortedDocuments.map((sortedSection, idx) => {
                return (
                  <div className="sorted-sections" key={`sortedSection-${idx}`}>
                    <div className="section-header">
                      <div className="section-header-label">
                      {sortedSection.icon ? <sortedSection.icon/>: null} {sortedSection.sectionLabel}
                      </div>
                    </div>
                    <div className="list">
                      {sortedSection.documents.map((doc: any, sortIdx: number) => {
                        const documentContext = getDocumentContext(doc);
                        return (
                          <DocumentContextReact.Provider key={doc.key} value={documentContext}>
                            {docFilter === "Problem"
                              ? <DecoratedDocumentThumbnailItem
                                  scale={0.1}
                                  document={doc}
                                  tab={ENavTab.kSortWork}
                                  shouldHandleStarClick={true}
                                  allowDelete={false}
                                  onSelectDocument={handleSelectDocument}
                                />
                              : <SimpleDocumentItem
                                  document={doc}
                                  investigationOrdinal={doc.investigation}
                                  problemOrdinal={doc.problem}
                                  onSelectDocument={handleSelectDocument}
                                />}
                          </DocumentContextReact.Provider>
                        );
                      })}
                    </div>
                  </div>
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
