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
      //returns Group # or Student Name, sets teacher docs to null
      if (sortByOption === "Group") {
        const userId = doc.uid; // Find the user that owns the document
        const group = groupsModel.groupForUser(userId); // Find the group the user is in from the groupsModel
        return group ? `Group ${group.id}` : null;
      }  else { //"Student"
        const user = stores.class.getUserById(doc.uid);
        return (user && user.type === "student") ? user.displayName : null;
        //TODO: investigate/verify that display name is last name, first name?
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
      documentMap.get(sectionLabel).documents.push(doc);// Add the document to the corresponding section
    });

  const sortedSectionLabels = (sortBy === "Group")
  ? Array.from(documentMap.keys()).filter(label => label != null).sort((a, b) => {
      // If sorting by "Group", we sort the groups numerically
      const numA = parseInt(a.replace(/^\D+/g, ''), 10); // Remove "Group " at the beginning
      const numB = parseInt(b.replace(/^\D+/g, ''), 10);
      return numA - numB;
    })
  : Array.from(documentMap.keys()).filter(label => label!= null ?? !label.includes("Teacher"));

    const sortedDocumentsArr = sortedSectionLabels.map(sectionLabel => documentMap.get(sectionLabel));
    return sortedDocumentsArr;
  };

  const sortedDocuments = getSortedDocuments(filteredDocsByType, sortBy);

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
          {
            sortedDocuments.map((sortedSection: any, idx)=>{
              return (
                <div className="sorted-sections" key={`sortedSection-${idx}`}>
                  <div className="section-header">
                    <div className="section-header-label">
                      {sortedSection.sectionLabel}
                    </div>
                  </div>

                    <div className={"list"}>
                      {
                        sortedSection.documents.map((doc: DocumentModelType, sortIdx: number) => {
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
                    </div>
                </div>

              );
            })
          }


          <div style={{marginTop: "100px"}}>
            _________________________________ All Docs Debug View _________________________________
            <br/><br/>
            { DEBUG_SORT_WORK && renderDebugView() }
            <br/> <br/>
            _________________________________ All Docs List View _________________________________
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
            </div>
          </div>

        </div>
      </div>
    </div>
  );
});



