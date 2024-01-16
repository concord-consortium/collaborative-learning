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

export const SortWorkView: React.FC = observer(function SortWorkView() {
  const { appConfig, persistentUI, sortedDocuments, documents } = useStores();
  const allDocuments = documents.all;

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

  //TODO: should we get rid of this and call on a method inside sortedDocuments where we pass the sortBy option
  //and it returns sortByGroup, sortByName, etc
  let sortedDocumentsOld; //this is what is rendered
  switch (sortBy) {
    case "Group":
      sortedDocumentsOld = sortedDocuments.sortByGroup;
      break;
    case "Name":
      sortedDocumentsOld = sortedDocuments.sortByName;
      break;
    case sortTagPrompt:
      sortedDocumentsOld = sortedDocuments.sortByStrategy;
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
    return filteredDocsByType.map((doc, idx) => {
      const ct = idx + 1;
      return (
        <pre key={idx} style={{ margin: "0px", padding: "0px", fontSize: "10px" }}>
          {ct < 10 && " "}{ct} | {doc.title?.slice(0, 20) || "                    "}
          | {doc.key} | {doc.type} | {doc.uid}
          | {doc?.isStarred? "T": "F"}
        </pre>
      );
    });
  };

  const filteredDocsByType = allDocuments.filter((doc: DocumentModelType) => { //remove
    return isSortableType(doc.type);
  });

  return (
    <div key="sort-work-view" className="sort-work-view">
      {
        showSortWorkDocumentArea ?
        <SortWorkDocumentArea openDocumentKey={openDocumentKey}/> :
        <>
          <SortWorkHeader sortBy={sortBy} sortByOptions={sortByOptions} />
          <div className="tab-panel-documents-section">
            { sortedDocumentsOld &&
              sortedDocumentsOld.map((sortedSection, idx) => {
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
