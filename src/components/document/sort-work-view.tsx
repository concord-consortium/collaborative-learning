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



//************************************ Refactor grouping logic into model ******************************************
//why are we doing this? is it related to the comments re-rendering?
//stored "sortedDocuments" into a model?

//this still wouldn't help the issue where we add a comment and teacher sees it in real time
//since we would still need an additional handler, but would implement the other half (mutating the model)

//observation - we star  a document for the first time - it re-renders sort-work-view
//               -if we unstar or star (after first time) - it doesn't re-render
//observation - accessing document.stars (or getter starred) property - then click on doc then go back, it throws error


////issue : when a comment is changed or added - no re-render happens
//long term - have a listener on the comments if that changes, then it would change the model,
// which would force a re-render
//•TODO: move the creation of documents, sorting, into MST Model
// start by making a new store - see if you can put it into documents.ts model

//***** Possible other requirement */
//•the document's last comment (with a tag) is the valid tag that we show on the UI,
// same document for different tags)
// if so- we would need to sort them by time


//***************************************** GUIDELINES ************************************************
//https://www.pivotaltracker.com/n/projects/2441242/stories/186506915
//✔️
// - stars should persist when they are created in the sort tab view
//   **currently when you star and refresh it doesn't persist,
//   **also we only have starred tab for mywork/classwork

// - introduce a Bookmark Sort as a choice in the sorts for any unit
//   ↳that allows bookmarking (Starring) in the Sort Workspaces Tab.


// - Revise the styling of stars to the new bookmarks - students got upset
//   ↳ that they weren't all getting gold stars. Both the unclicked and clicked bookmarks
//   ↳ need to be redone on thumbnails in my/class work and the new Sort Workspaces tab.

// - Revise the styling of stars to bookmarks in the Teacher Dashboard.

// - Revise the tab name of the "Starred" tab in any unit which shows it to Bookmarks


// - Bookmarks lists all the Bookmarked thumbs first, and "Not Bookmarked" second.
//   ↳With suitably tagged documents beneath that section.

// - Untagged documents are listed in a "Not Bookmarked" at the bottom

// - as documents are tagged they are automatically resorted

// - if there are no documents in a section say 'No workspaces' message appears.

// Notes: when this work is ongoing it might be worth looking at this bug: https://www.pivotaltracker.com/story/show/186683399

  //***************************************************************************************************


export const SortWorkView: React.FC = observer(function SortWorkView() {
  const { appConfig, persistentUI, sortedDocuments, documents } = useStores();
  // console.log("📁 sort-work-view.tsx ------------------------");
  // console.log(sortedDocuments.sortByGroup);
  const allDocuments = documents.all;

  const filteredDocsByType = allDocuments.filter((doc: DocumentModelType) => { //remove
    return isSortableType(doc.type);
  });

  //***************************** Determine Sort Options & State  *************************************
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

  let sortedDocumentsOld;
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

  const handleSelectDocument = (document: DocumentModelType) => {
    persistentUI.openSubTabDocument(ENavTab.kSortWork, ENavTab.kSortWork, document.key);
  };

  const tabState = persistentUI.tabs.get(ENavTab.kSortWork);
  const openDocumentKey = tabState?.openDocuments.get(ENavTab.kSortWork) || "";
  const showSortWorkDocumentArea = !!openDocumentKey;

  //*********************** Handle Debug View ******************************
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

  //TODO: double check zeplin spec - do we want to show Documents with no comments at all?

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
