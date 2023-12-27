import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React, { useState } from "react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { DocumentContextReact } from "./document-context";
import { DEBUG_SORT_WORK } from "../../lib/debug";
import { isSortableType } from "../../models/document/document-types";

import "../thumbnail/document-type-collection.sass";
import "./sort-work-view.scss";


// From Joe ----------------------------------------------------------------------------------------
// 1. Write the function that creates the groups of documents based on sortBy.
// A good place to start might be writing a function that returns this structure:
//   [
//     {
//       groupLabel: "2" | "Bob Smith", (depending on sortBy)
//       groupKey: <unique>
//       documents: [
//         { actualDocumentObj from store },
//         { actualDocumentObj from store },
//         { actualDocumentObj from store }
//       ]
//     }
//   ]
// While it was in my head, I wrote some pseudocode for what the “createGroupsOfDocuments” function might look like:
// const getGroupsOfDocuments = (documents: any[], sortBy: string) => {
//   const groupLabel = () => {
//     if (sortBy === "group"){
//       // who is the user that owns the document?
//       // what group are they in on the problem we are on now? (thats in groups.store)
//       // THAT is the group/groupLabel that we will place this document in (NOT the group found in doc.groupId)
//     }
//     if (sortBy === "name"){
//       // the group label is just the users name
//     }
//   };
// 2. Map over those groups, rendering the documents in groups in the sort view.
//    It could be a map in a map or broken out into a separate component for groups.
// 3. Note that you can now put sortWork in local storage as a debug key and the docs will render their ids
// 4. Get the functionality that opens a doc from the sort view to work
// ----------------------------------------------------------------------------------------


export const SortWorkView:React.FC = observer(function SortWorkView(){
  const sortOptions = ["Group", "Student"];
  const stores = useStores();
  const groupsModel = stores.groups;
  const [sortBy, setSortBy] = useState("Group");

  const filteredDocsByType = stores.documents.all.filter((doc:DocumentModelType) => {
    return isSortableType(doc.type);
  });


  const sortByOptions: ICustomDropdownItem[] = sortOptions.map((option)=>({
    text: option,
    onClick: () => setSortBy(option)
  }));

  const getSortedDocuments  = (documents: DocumentModelType[], sortByOption: string) => {

    const getSectionLabel = (doc: DocumentModelType) => {
      if (sortByOption === "Group") {
        const userId = doc.uid; // Find the user that owns the document
        const group = groupsModel.groupForUser(userId); // Find the group the user is in from the groupsModel
        return group ? `Group ${group.id}` : null;
      }  else { //"Student"
        const user = stores.class.getUserById(doc.uid);
        return user ? user.displayName : null; //TODO: this should eventually be last name, first name
      }
    };

    // Create a map to keep track of documents for each group label
    const documentMap = new Map();

    documents.forEach((doc) => {
      const sectionLabel = getSectionLabel(doc);
      if (!documentMap.has(sectionLabel)) {
        documentMap.set(sectionLabel, {
          sectionLabel,
          sectionKey: sectionLabel, //TODO: I don't think this would cause issues maybe a hyphened version would be best
          documents: []
        });
      }
      documentMap.get(sectionLabel).documents.push(doc);// Add the document to the corresponding section

    });

  const sortedSectionLabels = (sortBy === "Group")
  ? Array.from(documentMap.keys()).filter(label => label != null).sort((a, b) => {
      // If sorting by "Group", we sort the groups numerically
      const numA = parseInt(a.replace(/^\D+/g, ''), 10); // Remove "Group " at the beginning
      const numB = parseInt(b.replace(/^\D+/g, ''), 10);
      return numA - numB;
    })
  : Array.from(documentMap.keys());

    const sortedDocumentsArr = sortedSectionLabels.map(sectionLabel => documentMap.get(sectionLabel));
    return sortedDocumentsArr;
  };

  const sortedDocuments = getSortedDocuments(filteredDocsByType, sortBy);
  console.log("\t🔪 sortedDocuments:", sortedDocuments);

  const renderDebugView = () => {
    return filteredDocsByType.map((doc, idx: number) => {
      const ct = idx + 1;
      return (
        <pre key={idx} style={{margin:"0px", padding: "0px", fontSize: "10px"}}>
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
        <div className={"tab-panel-documents-section"}>
          { DEBUG_SORT_WORK && renderDebugView()}
          <div className={"list"}>
            {
              filteredDocsByType.map((doc:DocumentModelType, idx: number) => {
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
                      />
                  </DocumentContextReact.Provider>
                );
              })
            }
            {
              sortedDocuments.map((sortedSection: any)=>{
                console.log("sortedSection:", sortedSection);
                //TODO: style such that it matches spec, where there is a divider line and sectionLabel is the title
                return (
                  <div className="section" key={sortedSection.sectionKey}>

                  </div>
                );


              })
            }
          </div>
        </div>
      </div>
    </div>
  );
});



