import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { useStores } from "../../hooks/use-stores";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { DocumentContextReact } from "./document-context";
import { DEBUG_SORT_WORK } from "../../lib/debug";
import { SortWorkDocumentArea } from "./sort-work-document-area";
import { ENavTab } from "../../models/view/nav-tabs";
import { isSortableType } from "../../models/document/document-types";

import "../thumbnail/document-type-collection.sass";
import "./sort-work-view.scss";

export const filteredDocsByType = (allDocuments: DocumentModelType[]) =>{
  return allDocuments.filter((doc: DocumentModelType) => {
    return isSortableType(doc.type);
  });
};

export const SortWorkView: React.FC = observer(function SortWorkView() {
  const { appConfig, persistentUI, sortedDocuments, documents } = useStores();

  //*************************** Determine Sort Options & State  ***********************************
  const {tagPrompt} = appConfig;
  const sortTagPrompt = tagPrompt || ""; //first dropdown choice for comment tags
  const sortOptions = ["Group", "Name", sortTagPrompt, "Bookmarked"];
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
    case sortTagPrompt:
      renderedSortedDocuments = sortedDocuments.sortByStrategy;
      break;
  }

  //******************************* Click to Open Document  ***************************************
  const handleSelectDocument = (document: DocumentModelType) => {
    persistentUI.openSubTabDocument(ENavTab.kSortWork, ENavTab.kSortWork, document.key);
  };

  const tabState = persistentUI.tabs.get(ENavTab.kSortWork);
  const openDocumentKey = tabState?.openDocuments.get(ENavTab.kSortWork) || "";
  const showSortWorkDocumentArea = !!openDocumentKey;

  //****************************************** Handle Debug View **********************************

  const renderDebugView = () => {
    //returns a list lf all documents (unsorted)
    return filteredDocsByType(documents.all).map((doc, idx) => {
      const ct = idx + 1;
      return (
        <React.Fragment key={idx}>
          { idx === 0 &&
            <pre key={`title-row`} style={{ margin: "0px", padding: "0px", fontSize: "10px", color:"blue" }}>
              &nbsp;
              | key  {" ".repeat(17)}
              | type {" ".repeat(7)}
              | viz  {" ".repeat(5)}
              | uid {" ".repeat(1)}
              | gp {" ".repeat(0)}
              | title {" ".repeat(4)}
            </pre>
          }
          <hr style={{ margin: "0px", padding: "0px" }}/>
          <pre key={`pre-${idx}`} style={{ margin: "0px", padding: "0px", fontSize: "10px" }}>
            {ct < 10 && " "}{ct}
            | {doc.key}&nbsp;
            | {doc.type}{' '.repeat(12 - doc.type.length)}
            | {doc.visibility ? doc.visibility + " ".repeat(10 - doc.visibility.length) : "undefined "}
            | {doc.uid}{' '.repeat(5 - doc.uid.length)}
            | {doc.groupId ?? " "}&nbsp;
            | {doc.title?.slice(0, 20)}
          </pre>
        </React.Fragment>
      );
    });
  };



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
            {DEBUG_SORT_WORK && renderDebugView()}
          </div>
        </>
      }
    </div>
  );
});
