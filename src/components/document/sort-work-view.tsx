import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React, { useEffect, useState } from "react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { ICustomDropdownItem } from "../../clue/components/custom-select";

import "./sort-work-view.scss";


export const SortWorkView:React.FC = observer(function SortWorkView(){
  const sortOptions = ["Group", "Student"];
  const stores = useStores();
  const [sortBy, setSortBy] = useState("Group");
  const [sortedAll, setSortedAll] = useState<any[]>(stores.documents.all);

  const sortByOptions: ICustomDropdownItem[] = sortOptions.map((option)=>({
    text: option,
    onClick: () => setSortBy(option)
  }));

  useEffect(() => {
    console.log("handle change of sortBy");
  }, [sortBy]);

  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader sortBy={sortBy} sortByOptions={sortByOptions} />
      {
        sortedAll.map((doc:any, idx: number) => {

          return (
            <pre style={{padding:0, margin:0}} key={`${doc.key}`}>
              {doc.key} | group: {doc.groupId ?? "_"} | user: {doc.uid} | {doc.type}
            </pre>
          );
        })
      }
    </div>
  );
});

