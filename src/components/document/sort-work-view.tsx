import React, { useState } from "react";
import { observer } from "mobx-react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { useStores, usePersistentUIStore, useAppConfig } from "../../hooks/use-stores";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { DocumentContextReact } from "./document-context";
import { DEBUG_SORT_WORK } from "../../lib/debug";
import { isSortableType } from "../../models/document/document-types";
import { SortWorkDocumentArea } from "./sort-work-document-area";
import { ENavTab } from "../../models/view/nav-tabs";

import "../thumbnail/document-type-collection.sass";
import "./sort-work-view.scss";


//TODO:
//In this component we need to call firestore to find the tag
// documents > document id > comments > comment id > (property )tag:

//How do we know all the tags available to populate the drop down?
//find all available tags from the comments panel (where you select the tag)
//find all tags through iterated documents: for each document youd have to itate through comments to find each tag
// combine both above for a superset of all "tags"

//get all documents from doc store, then find comments with a tag(simpler approach)
//look for all documens in a class, for each document find a comment with a tag (could be a compound query)

//****************************************** GUIDELINES  ***********************************************
//Questions? - Do I need to make a 2nd dropdown in this ticket? an't exactly tell from the ticket guidelines
// •introduce a Strategy Sort as a choice in the sorts for any unit that has tags in comments

// •use the first dropdown choice as the name of the filter (or make a unique tag in the unit for this).
//  For example - in the CMP math units it says Select Student Strategy, so 'Student Strategy'
//  would be the name of the sort.

// •Strategy lists all the strategies in the tags list, with suitably tagged documents beneath that section.
// •Untagged documents are listed in a "Not Tagged" at the bottom
// •As documents are tagged they are automatically resorted
// •if there are no documents in a strategy a 'No workspaces' message appears.
// •If more than one is applied, show under each that matches


//Test URLS:
//Below should be Identify Design Approach
//http://localhost:8080/?appMode=demo&demoName=dennis1&fakeClass=1&fakeUser=teacher:1&problem=1.1&unit=example-config-subtabs&curriculumBranch=sort-tab-dev-3
//Find another URL that has a different default first tag
//*****************************************************************************************************


export const SortWorkView: React.FC = observer(function SortWorkView() {
  const appConfigStore = useAppConfig();
  console.log("\t🔪 appConfigStore:", appConfigStore);
  const persistentUI = usePersistentUIStore();


  //******************* Determine Sort Options & State  ***********************************
  const {tagPrompt} = appConfigStore; //first dropdown choice for comment tags
  const sortTagPrompt = tagPrompt || "";
  const sortOptions = ["Group", "Name", sortTagPrompt];
  const stores = useStores();
  const groupsModel = stores.groups;
  const [sortBy, setSortBy] = useState("Group");

  //******************* ?? Determine openDocument  ***********************************
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(ENavTab.kSortWork);
  const tabState = navTabSpec && persistentUI.tabs.get(navTabSpec?.tab);
  const openDocumentKey = tabState?.openDocuments.get(ENavTab.kSortWork) || "";
  const showSortWorkDocumentArea = !!openDocumentKey;


  //******************************* Sorting Documents *************************************
  const filteredDocsByType = stores.documents.all.filter((doc: DocumentModelType) => {
    return isSortableType(doc.type);
  });

  const sortByOptions: ICustomDropdownItem[] = sortOptions.map((option) => ({
    text: option,
    onClick: () => setSortBy(option)
  }));

  const getSortedDocuments = (documents: DocumentModelType[], sortByOption: string) => {
    const getSectionLabel = (doc: DocumentModelType) => {
      if (sortByOption === "Group") {
        const userId = doc.uid;
        const group = groupsModel.groupForUser(userId);
        return group ? `Group ${group.id}` : "No Group";
      } else { //sortOption === "Name"
        const user = stores.class.getUserById(doc.uid);
        return (user && user.type === "student") ? `${user.lastName}, ${user.firstName}` : "Teacher";
      }
    };

    const documentMap = new Map();

    documents.forEach((doc) => {
      const sectionLabel = getSectionLabel(doc);
      if (!documentMap.has(sectionLabel)) {
        documentMap.set(sectionLabel, {
          sectionLabel,
          documents: []
        });
      }
      documentMap.get(sectionLabel).documents.push(doc);
    });

    let sortedSectionLabels;

    if (sortByOption === "Group") {
      sortedSectionLabels = Array.from(documentMap.keys()).sort((a, b) => {
        const numA = parseInt(a.replace(/^\D+/g, ''), 10);
        const numB = parseInt(b.replace(/^\D+/g, ''), 10);
        return numA - numB;
      });
    } else {
      sortedSectionLabels = Array.from(documentMap.keys()).sort(customSort);
    }
    return sortedSectionLabels.map(sectionLabel => documentMap.get(sectionLabel));
  };

  function customSort(a: any, b: any) { //sort by last name alphabetically
    const parseName = (name: any) => {
      const [lastName, firstName] = name.split(", ").map((part: any) => part.trim());
      const lastNameNum = parseInt(lastName, 10);
      return {
        firstName,
        lastName,
        isNumericLastName: !isNaN(lastNameNum),
        lastNameNum
      };
    };
    const aParsed = parseName(a);
    const bParsed = parseName(b);
    if (aParsed.isNumericLastName && bParsed.isNumericLastName) {
      return aParsed.lastNameNum - bParsed.lastNameNum;
    }
    if (aParsed.isNumericLastName) return -1;
    if (bParsed.isNumericLastName) return 1;

    const lastNameCompare = aParsed.lastName.localeCompare(bParsed.lastName);
    if (lastNameCompare !== 0) return lastNameCompare;
    return aParsed.firstName.localeCompare(bParsed.firstName);
  }

  const sortedDocuments = getSortedDocuments(filteredDocsByType, sortBy);

  //******************************* Show Document View ***************************************
  const handleSelectDocument = (document: DocumentModelType) => {
    persistentUI.openSubTabDocument(ENavTab.kSortWork, ENavTab.kSortWork, document.key);
  };

  //******************************* Handle Debug View ***************************************
  const renderDebugView = () => {
    //returns a list lf all documents (unsorted)
    return filteredDocsByType.map((doc, idx) => {
      const ct = idx + 1;
      return (
        <pre key={idx} style={{ margin: "0px", padding: "0px", fontSize: "10px" }}>
          {ct < 10 && " "}{ct} | {doc.title?.slice(0, 20) || "                    "}
          | {doc.key} | {doc.type} | {doc.uid}
        </pre>
      );
    });
  };


  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader sortBy={sortBy} sortByOptions={sortByOptions} />

      {
        showSortWorkDocumentArea ?
        <SortWorkDocumentArea openDocumentKey={openDocumentKey}/> :
        <div className="tab-panel-documents-section">
          {
            sortedDocuments.map((sortedSection, idx) => {
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
      }
    </div>
  );
});
