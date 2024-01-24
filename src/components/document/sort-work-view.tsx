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

import "../thumbnail/document-type-collection.sass";
import "./sort-work-view.scss";

//********************************************* Guidelines ✔️ ↳ • **************************************
// • introduce a Tools Filter for any unit that has one or more of the Tool/Tile Types specified in the unit

// documents with no tool tiles are listed in a "No Tools" at the bottom
// as documents gain content they are automatically resorted


//TileTypes =
// Text, Table, Data card, Image, Drawing, Expression, XYPlot, Graph, Numberline, Dataflow.
// Simulator, Diagram, Program (same as Dataflow)
//"Geometry

//doesn't seem like we care about Placeholders

//TODO:
//Treat filtering of sparrows as a seperate story
//Treat stretch goal as seperate story (kirk)
    // Stretch goal - Identify and store the tool type and count with each document


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

  //******************************* Click to Open Document  ***************************************
  const handleSelectDocument = (document: DocumentModelType) => {
    persistentUI.openSubTabDocument(ENavTab.kSortWork, ENavTab.kSortWork, document.key);
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
          <SortWorkHeader sortBy={sortBy} sortByOptions={sortByOptions} />
          <div className="tab-panel-documents-section">
            { renderedSortedDocuments &&
              renderedSortedDocuments.map((sortedSection, idx) => {
                return (
                  <div className="sorted-sections" key={`sortedSection-${idx}`}>
                    <div className="section-header">
                      <div className="section-header-label">
                        {sortedSection.sectionLabel}
                      </div>
                    </div>
                    <div className="list">
                      {sortedSection.documents.map((doc: any, sortIdx: number) => {
                        const documentContext = getDocumentContext(doc);
                        return (
                          <DocumentContextReact.Provider key={doc.key} value={documentContext}>
                            <DecoratedDocumentThumbnailItem
                              key={doc.key}
                              scale={0.1}
                              document={doc}
                              tab={ENavTab.kSortWork}
                              shouldHandleStarClick={true}
                              allowDelete={false}
                              onSelectDocument={handleSelectDocument}
                            />
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
