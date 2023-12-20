import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React, { useEffect, useState } from "react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { ICustomDropdownItem } from "../../clue/components/custom-select";

import "./sort-work-view.scss";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { ENavTab } from "../../models/view/nav-tabs";
import { getDocumentContext } from "../../models/document/document";
import { DocumentContextReact } from "./document-context";


export const SortWorkView:React.FC = observer(function SortWorkView(){
  const sortOptions = ["Group", "Student"];
  const stores = useStores();
  const [sortBy, setSortBy] = useState("Group");
  const [sortedAll, setSortedAll] = useState<any[]>(stores.documents.all);
  const sectionModelToGetRidOf = stores?.appConfig?.navTabs?.getNavTabSpec(ENavTab.kSortWork)?.sections[0];

  const sortByOptions: ICustomDropdownItem[] = sortOptions.map((option)=>({
    text: option,
    onClick: () => setSortBy(option)
  }));

  useEffect(() => {
    console.log("| sort by: ", sortBy);
  }, [sortBy]);

  const tempDebugView = false;
  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader sortBy={sortBy} sortByOptions={sortByOptions} />
      <div className="documents-panel">
      {
        sortedAll.map((doc:any, idx: number) => {
          const documentContext = getDocumentContext(doc);

          return (
            <DocumentContextReact.Provider key={doc.key} value={documentContext}>


                    {!tempDebugView &&
                      <DecoratedDocumentThumbnailItem
                        key={doc.key}
                        scale={0.1}
                        section={sectionModelToGetRidOf as any} // TODO : refactor so not required
                        document={doc}
                        tab={'sort-work'}
                      />
                    }

                    { tempDebugView &&
                      <pre style={{padding:0, margin:0}} key={`${doc.key}`}>
                        {doc.key} | group: {doc.groupId ?? "_"} | user: {doc.uid} | {doc.type}
                      </pre>
                    }

            </DocumentContextReact.Provider>
          );
        })

      }
      </div>
    </div>
  );
});
