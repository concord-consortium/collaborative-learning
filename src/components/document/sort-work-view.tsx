import { observer } from "mobx-react";
import { useAppConfig, usePersistentUIStore, useStores } from "../../hooks/use-stores";
import React from "react";
import { PersonalDocument, ProblemDocument } from "../../models/document/document-types";
import { NavTabModelType } from "../../models/view/nav-tabs";

import "./sort-work-view.scss";


interface ISortProps {
  tabSpec: NavTabModelType;
  isChatOpen: boolean;
}

export const SortWorkView:React.FC<ISortProps> = observer(function SortWorkView({ tabSpec, isChatOpen }){
  const stores = useStores();
  const allDocuments = stores.documents;
  const problemDocuments = allDocuments.byType(ProblemDocument);
  const personalDocuments = allDocuments.byType(PersonalDocument);

  console.log("📁 sort-work-view.tsx ------------------------");
  // console.log("\t🥩 isChatOpen:", isChatOpen);
  // console.log("\t🥩 tabSpec:", tabSpec);

  const persistentUI = usePersistentUIStore();
  const appConfigStore = useAppConfig();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  console.log("\t🔪 navTabSpec:", navTabSpec);
  console.log("\t🔪 navTabSpec?.tab:", navTabSpec?.tab);

  const tabState = navTabSpec && persistentUI.tabs.get(navTabSpec?.tab);
  console.log("\t🥩 Sort tabState:", tabState);


//   const temp =  <DocumentCollectionList
//   subTab={subTab}

// />
  return (
    <div
      key="sort-work-view"
      className="sort-work-view"
    >
      <div className="sort-work-header"/>
      <div className="sort-work-documents">
        <div className="live-problem-documents">
          {"Problem Documents (Not Published) - Include documents from all assignments"}
          {
            problemDocuments.map((doc:any, idx: number) =>{
              return (
                <div key={`entry-${idx}`} className="entry">  {doc.key} </div>
              );
            })
          }

        </div>
        <div className="live-personal-documents">
          {"Personal Documents (Not Published)"}
        </div>


      </div>

    </div>
  );
});
