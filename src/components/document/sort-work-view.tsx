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

export const SortWorkView: React.FC = observer(function SortWorkView() {
  const sortOptions = ["Group", "Student"];
  const stores = useStores();
  const groupsModel = stores.groups;
  const [sortBy, setSortBy] = useState("Group");

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
      } else {
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

  //******************************* Show Document View ***************************************
  const persistentUI = usePersistentUIStore();

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
