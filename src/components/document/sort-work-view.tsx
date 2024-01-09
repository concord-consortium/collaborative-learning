import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { useStores, useAppConfig } from "../../hooks/use-stores";
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


//TODO:✔️
//In this component we need to call firestore to find the tag
// documents > document id > comments > comment id > (property )tag:

//✔️ find all available tags from the comments panel (where you select the tag)
//find all tags through iterated documents: for each document youd have to itate through comments to find each tag
// combine both above for a superset of all "tags"

//two approaches
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

//TODO: move the creation of documents, sorting, into MST Model
// start by making a new store - see if you can put it into documents.ts model

//issue : when a comment is changed or added - no re-render happens
//long term - have a listener on the comments if that changes, then it would change the model,
// which would force a re-render

export const SortWorkView: React.FC = observer(function SortWorkView() {
  const { appConfig, persistentUI } = useStores();

  //************************* Determine Sort Options & State  *************************************
  const {tagPrompt, commentTags} = appConfig;
  console.log("commentTags:", commentTags);
  const sortTagPrompt = tagPrompt || ""; //first dropdown choice for comment tags
  const sortOptions = ["Group", "Name", sortTagPrompt];
  const stores = useStores();
  const groupsModel = stores.groups;
  const [sortBy, setSortBy] = useState("Group");

  //******************************** Sort by Strategy **********************************************

  // Our state tagsWithDocs will be a Record of TagWithDocs structures
  type TagWithDocs = {
    tagKey: string;
    tagValue: string;
    docKeysFoundWithTag: string[];
  };

  const [db] = useFirestore();
  //initialize state with commentTags
  const [tagsWithDocs, setTagsWithDocs] = useState<Record<string, TagWithDocs>>(() => {
    const initialTags: Record<string, TagWithDocs> = {
      "": { //this accounts for when user commented with tagPrompt (no tag selected)
        tagKey: "",
        tagValue: "Comment w/o Tags",
        docKeysFoundWithTag: []
      }
    };
    // Check if commentTags is defined before using it
    if (commentTags) {
      // Use the keys from commentTags to initialize the structure
      for (const key of Object.keys(commentTags)) {
        initialTags[key] = {
          tagKey: key,
          tagValue: commentTags[key],
          docKeysFoundWithTag: []
        };
      }
    }
    return initialTags;
  });

  useEffect(() => {
    const tempTagDocumentMap = new Map<string, Set<string>>();
    const unsubscribeFromDocs = db.collection("documents").onSnapshot(docsSnapshot => {
      docsSnapshot.forEach(doc => {
        const docData = doc.data();
        const docKey = docData.key;
        const commentsRef = doc.ref.collection("comments"); //access sub collection
        commentsRef.get().then(commentsSnapshot => {
          commentsSnapshot.forEach(commentDoc => {
            const commentData = commentDoc.data();
            if (commentData && commentData.tags) {
              commentData.tags.forEach((tag: string) => {
                let docKeysSet = tempTagDocumentMap.get(tag);
                if (!docKeysSet) {
                  docKeysSet = new Set<string>();
                  tempTagDocumentMap.set(tag, docKeysSet);
                }
                docKeysSet.add(docKey); //only unique doc keys will be stored
              });
            }
          });

          // After all comments are processed, update the state
          setTagsWithDocs(prevTagsWithDocs => {
            const updatedTagsWithDocs = { ...prevTagsWithDocs };
            tempTagDocumentMap.forEach((docKeysSet, tag) => {
              const docKeysArray = Array.from(docKeysSet); // Convert the Set to an array
              if (updatedTagsWithDocs[tag]) {
                // If the tag is already in the state, update the docKeys
                updatedTagsWithDocs[tag].docKeysFoundWithTag = docKeysArray;
              } else {
                // If the tag is new (not in the initial tags), add it to the state
                updatedTagsWithDocs[tag] = {
                  tagKey: tag,
                  tagValue: tag, // Since we don't have a value, use the tag itself
                  docKeysFoundWithTag: docKeysArray
                };
              }
            });
            // Return the updated object for the state
            return updatedTagsWithDocs;
          });
        });
      });
    });

    // Cleanup function to unsubscribe from Firestore when the component unmounts
    return () => unsubscribeFromDocs();
  }, [db]);




  console.log("tagsWithDocs:", tagsWithDocs);







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
      switch (sortByOption){
        case "Group": {
          const userId = doc.uid;
          const group = groupsModel.groupForUser(userId);
          return group ? `Group ${group.id}` : "No Group";
          break;
        }
        case "Name":{
          const user = stores.class.getUserById(doc.uid);
          return (user && user.type === "student") ? `${user.lastName}, ${user.firstName}` : "Teacher";
          break;
        }
        case sortTagPrompt: {
          // Initialize the label as "Documents w/o Tags"

          break; // Found the document key, no need to continue the search


        }
      }
    };

    const documentMap = new Map();

    documents.forEach((doc) => {

      const sectionLabel = getSectionLabel(doc);
      // console.log("--------------");
      // console.log("\tdoc.title:", doc.title);
      // console.log("\tsectionLabel:", sectionLabel);

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
    const returnVal = sortedSectionLabels && sortedSectionLabels.map(sectionLabel => documentMap.get(sectionLabel));

    // console.log("\t💩 returnVal:", returnVal);
    return sortedSectionLabels && sortedSectionLabels.map(sectionLabel => documentMap.get(sectionLabel));
  };

  function customSort(a: any, b: any) { //Sort by last name alphabetically
    const parseName = (name: any) => {
      const [lastName, firstName] = name.split(", ").map((part: any) => part.trim());
      return { firstName, lastName };
    };
    const aParsed = parseName(a);
    const bParsed = parseName(b);

    const lastNameCompare = aParsed.lastName.localeCompare(bParsed.lastName);
    if (lastNameCompare !== 0) {
      return lastNameCompare;
    }

    return aParsed.firstName.localeCompare(bParsed.firstName);
  }

  const sortedDocuments = getSortedDocuments(filteredDocsByType, sortBy);

  //******************************* Click/Open Document ***************************************
  const handleSelectDocument = (document: DocumentModelType) => {
    persistentUI.openSubTabDocument(ENavTab.kSortWork, ENavTab.kSortWork, document.key);
  };

  const appConfigStore = useAppConfig();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(ENavTab.kSortWork);
  const tabState = navTabSpec && persistentUI.tabs.get(ENavTab.kSortWork);
  const openDocumentKey = tabState?.openDocuments.get(ENavTab.kSortWork) || "";
  const showSortWorkDocumentArea = !!openDocumentKey;

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
      {
        showSortWorkDocumentArea ?
        <SortWorkDocumentArea openDocumentKey={openDocumentKey}/> :
        <>
          <SortWorkHeader sortBy={sortBy} sortByOptions={sortByOptions} />
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
        </>
      }
    </div>
  );
});
