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

//OBSERVATIONS
// 1) ⚡ Notied that bookmarking "planning documents" does not persist even appMode=dev
// 2) Scott said that in a new PR (need to make) - change all the classes, functions,
//     variables i.e anything alluding to “star” and rename them to allude to “bookmark” correct?

//GUIDELINES•✔️
//• stars should persist when they are created in the sort tab view
// ↳ Fix non persistence of stars(now bookmarks) when appMode=demo


//•Revise the styling of stars to bookmarks in the Teacher Dashboard.
//•Revise the tab name of the "Starred" tab in any unit which shows it to Bookmarks

//•Bookmarks lists all the Bookmarked thumbs first, and "Not Bookmarked" second. , with suitably tagged documents beneath that section.

//•Untagged documents are listed in a "Not Bookmarked" at the bottom

//•As documents are tagged they are automatically resorted

//---------------------------------- Done -------------------------------------
//✔️introduce a Bookmark Sort as a choice in the sorts for any unit that allows
// bookmarking (Starring) in the Sort Workspaces Tab.

//✔️Revise the styling of stars to the new bookmarks - students got upset that they weren't all getting gold stars.

//✔️ Both the unclicked and clicked bookmarks need to be redone on thumbnails in my/class work and the new Sort Workspaces tab.




// Specs: https://zpl.io/Dl5M5nw


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
        <pre key={idx} style={{ margin: "0px", padding: "0px", fontSize: "10px" }}>
          {ct < 10 && " "}{ct} | {doc.title?.slice(0, 20) || "                    "}
          | {doc.key} | {doc.type} | {doc.uid}
          | {doc?.isStarred? "T": "F"}
        </pre>
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
