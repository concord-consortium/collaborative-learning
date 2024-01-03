import React, { useState } from "react";
import { observer } from "mobx-react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { useStores, usePersistentUIStore } from "../../hooks/use-stores";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { NavTabModelType } from "../../models/view/nav-tabs";
import { DocumentContextReact } from "./document-context";
import { DEBUG_SORT_WORK } from "../../lib/debug";
import { isSortableType } from "../../models/document/document-types";

import "../thumbnail/document-type-collection.sass";
import "./sort-work-view.scss";
import { SortWorkDocumentArea } from "./sort-work-document-area";

interface IProps {
  tabSpec: NavTabModelType
}

export const SortWorkView: React.FC<IProps> = observer(function SortWorkView({ tabSpec }) {
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
  const persistentUI = usePersistentUIStore();
  const [showDocument, setShowDocument] = useState(false);

  const handleSelectDocument = (document: DocumentModelType) => {
    setShowDocument(prev => !prev);
    persistentUI.openSubTabDocument(tabSpec.tab, "sort-work", document.key);
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
      <div className="documents-panel">
        <div className="tab-panel-documents-section">
          {
            showDocument ?
            <SortWorkDocumentArea
              tabSpec={tabSpec}
              tab={"sort-work"}
            />
            :
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
                            tab={"sort-work"}
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
            })}
          {DEBUG_SORT_WORK && renderDebugView()}
        </div>
      </div>
    </div>
  );
});
