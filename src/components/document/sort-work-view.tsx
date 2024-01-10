import React, { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { useStores } from "../../hooks/use-stores";
import { useFirestore } from "../../hooks/firestore-hooks";
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

export const SortWorkView: React.FC = observer(function SortWorkView() {
  const { appConfig, persistentUI } = useStores();

  //***************************** Determine Sort Options & State  *************************************
  const {tagPrompt, commentTags} = appConfig;
  const sortTagPrompt = tagPrompt || ""; //first dropdown choice for comment tags
  const sortOptions = ["Group", "Name", sortTagPrompt];
  const stores = useStores();
  const groupsModel = stores.groups;
  const [sortBy, setSortBy] = useState("Group");

  const sortByOptions: ICustomDropdownItem[] = sortOptions.map((option) => ({
    text: option,
    onClick: () => setSortBy(option)
  }));

  //**************************** Sorting by "Group" & "Name" ******************************************

  const getSortedDocuments = (documents: DocumentModelType[], sortByOption: string) => {
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

    function getSectionLabel(doc: DocumentModelType){
      //Only used in sortBy "Group" & "Name"
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
        default:
          break;
      }
    }

    let sortedSectionLabels: SortedDocument[] = [];

    switch (sortByOption){
      case "Group": {
        sortedSectionLabels = Array.from(documentMap.keys()).sort((a, b) => {
          const numA = parseInt(a.replace(/^\D+/g, ''), 10);
          const numB = parseInt(b.replace(/^\D+/g, ''), 10);
          return numA - numB;
        });
        break;
      }
      case "Name": {
        sortedSectionLabels = Array.from(documentMap.keys()).sort(customSortByName);
        break;
      }
      case sortTagPrompt: {
        break;
      }

    }
    return sortedSectionLabels.map(sectionLabel => documentMap.get(sectionLabel));
  };

  function customSortByName(a: any, b: any) { //Sort by last name alphabetically
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

  //******************************** Sort by Strategy *************************************************
  type TagWithDocs = {
    tagKey: string;
    tagValue: string;
    docKeysFoundWithTag: string[];
  };

  const tagsWithDocs: Record<string, TagWithDocs> = useMemo(() => {

    const initialTags: Record<string, TagWithDocs> = {};
    if (commentTags) {
      // Use the keys from commentTags to initialize the structure
      for (const key of Object.keys(commentTags)) {
        initialTags[key] = {
          tagKey: key,
          tagValue: commentTags[key],
          docKeysFoundWithTag: []
        };
      }
      initialTags[""] = { //this accounts for when user commented with tagPrompt (no tag selected)
        tagKey: "",
        tagValue: "Not Tagged",
        docKeysFoundWithTag: []
      };
    }
    return initialTags;
  }, [commentTags]); //Recalculate this when commentTags have changed.

  //------- Query Firestore for documents, for each doc with a comment
  // populate docKeysFoundWithTag with docKey
  const [db] = useFirestore();
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
          //Update docKeysFoundWithTag property in tagsWithArray
          tempTagDocumentMap.forEach((docKeysSet, tag) => {
            const docKeysArray = Array.from(docKeysSet); // Convert the Set to an array
            if (tagsWithDocs[tag]) {
              tagsWithDocs[tag].docKeysFoundWithTag = docKeysArray;
            }
          });
        });
      });
      return tagsWithDocs;
    });

    return () => unsubscribeFromDocs(); // Cleanup function to unsubscribe from Firestore
  }, [db, tagsWithDocs]);

  const convertTagsWithDocsToSortedDocuments = (tagsWithDocsObj: Record<string, TagWithDocs>) => {
    const sortedDocsArr: SortedDocument[] = [];

    Object.entries(tagsWithDocsObj).forEach((tagKeyAndValObj) => {
      const tagWithDocs = tagKeyAndValObj[1] as TagWithDocs;
      const sectionLabel = tagWithDocs.tagValue;
      const docKeys = tagWithDocs.docKeysFoundWithTag;
      const documents = allDocuments.filter(doc => docKeys.includes(doc.key));
      sortedDocsArr.push({
        sectionLabel,
        documents
      });
    });

    return sortedDocsArr;
  };

  //************************** Determine sortedDocuments to render ************************************
  //-- "Group" and "Name" need to be displayed in a sorted order
  //-- "sortTagPrompt" (or sort by strategy) should be rendered order of commentTags
  const allDocuments = stores.documents.all;

  const filteredDocsByType = allDocuments.filter((doc: DocumentModelType) => {
    return isSortableType(doc.type);
  });

  type SortedDocument = {
    sectionLabel: string;
    documents: DocumentModelType[];
  }

  let sortedDocuments;

  switch (sortBy) {
    case "Group":
    case "Name":
      sortedDocuments = getSortedDocuments(filteredDocsByType, sortBy);
      break;
    case sortTagPrompt:
      sortedDocuments = convertTagsWithDocsToSortedDocuments(tagsWithDocs);
      break;
  }

  //******************************* Click/Open Document View ******************************************
  const handleSelectDocument = (document: DocumentModelType) => {
    persistentUI.openSubTabDocument(ENavTab.kSortWork, ENavTab.kSortWork, document.key);
  };

  const tabState = persistentUI.tabs.get(ENavTab.kSortWork);
  const openDocumentKey = tabState?.openDocuments.get(ENavTab.kSortWork) || "";
  const showSortWorkDocumentArea = !!openDocumentKey;

  //******************************* Handle Debug View *************************************************
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
            { sortedDocuments &&
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
