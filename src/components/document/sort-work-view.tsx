import React, { useState } from "react";
import { observer } from "mobx-react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { useStores, usePersistentUIStore, useAppConfig } from "../../hooks/use-stores";
import { useUserContext } from "../../hooks/use-user-context";
import { ICustomDropdownItem } from "../../clue/components/custom-select";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { ISubTabSpec, NavTabModelType } from "../../models/view/nav-tabs";
import { DocumentContextReact } from "./document-context";
import { DEBUG_SORT_WORK } from "../../lib/debug";
import { isSortableType } from "../../models/document/document-types";
import { useQueryClient } from "react-query";

import "../thumbnail/document-type-collection.sass";
import "./sort-work-view.scss";
import { DocumentView } from "../navigation/document-view";

// 2. Map over those groups, rendering the documents in groups in the sort view.
//    It could be a map in a map or broken out into a separate component for groups.
// 3. Note that you can now put sortWork in local storage as a debug key and the docs will render their ids
// 4. Get the functionality that opens a doc from the sort view to work
// ----------------------------------------------------------------------------------------

interface IProps {
  tabSpec: NavTabModelType
}

export const SortWorkView:React.FC<IProps> = observer(function SortWorkView({tabSpec}){
  const sortOptions = ["Group", "Student"];
  const stores = useStores();
  const groupsModel = stores.groups;
  const [sortBy, setSortBy] = useState("Group");

  //******************************* Sorting Documents *************************************

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

  //******************************* Opening Documents *************************************
  const persistentUI = usePersistentUIStore();
  const appConfigStore = useAppConfig();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  const subTabs = tabSpec.subTabs;
  const tabState = navTabSpec && persistentUI.tabs.get(navTabSpec?.tab);

  console.log("\t🥩 subTabs:", subTabs);
  //TODO: fix subTab object to look like correct,
  //needs to match subtabs object to look like section-document-or-browser
  const selectedSubTab = subTabs[0];
  console.log("\t🥩 selectedSubTab:", selectedSubTab);
  const focusDocument = persistentUI.focusDocument;
  const [showDocument, setShowDocument] = useState(false);
  const queryClient = useQueryClient();
  const context = useUserContext();

  const renderDocumentView = (subTab: ISubTabSpec) => {
    console.log("➡️ renderDocumentView");
    console.log("\t🥩 subTab:", subTab);
    return (
      <>
        <div>hello world</div>
        <DocumentView
          tabSpec={tabSpec}
          subTab={subTab}
        />
        {/* { renderSubTabPanel(subTab) } */}
      </>
    );
  };

  const handleSelectDocument = (document: DocumentModelType) => {
    setShowDocument(prev => !prev);
    persistentUI.openSubTabDocument(tabSpec.tab, "None", document.key);
  };


  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader sortBy={sortBy} sortByOptions={sortByOptions} />
      <div className="documents-panel">
        <div className={"tab-panel-documents-section"}>
          {

            showDocument ?
            renderDocumentView(tabSpec)
            :
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
                                onSelectDocument={handleSelectDocument}
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


