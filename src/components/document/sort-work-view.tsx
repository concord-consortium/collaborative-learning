import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React, { useEffect, useState } from "react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { ICustomDropdownItem } from "../../clue/components/custom-select";

import "./sort-work-view.scss";

  /* modelling after DocumentCollectionByType (documents-type-collection.tsx):
      0 get the groups and the users
      1 map out to a flat array of all the docs of each user from each group
      2 render those from stores
      3 ensure handlers are working, perhaps moving some dowen chain (already done with delete, eg)
  */

const sortByGroup = (docs: any) => {
  console.log("-----sorting!!! ----------");
  const groupIds = docs.map((doc: any) => doc.groupId);
  const uniqueGroupIds = new Set(groupIds);
  const sortedUniqueGroupIds = Array.from(uniqueGroupIds).sort((a: any, b: any) => a - b);

  const sortedDocs = sortedUniqueGroupIds.flatMap(
    groupId => docs.filter((doc: any) => doc.groupId === groupId)
  );
  return sortedDocs;
};

export const SortWorkView:React.FC = observer(function SortWorkView(){
  const sortOptions = ["Group", "Student"];
  const stores = useStores();
  const [sortBy, setSortBy] = useState("Group");
  const sortable = stores.documents.all;
  const [sortedAll, setSortedAll] = useState<any[]>(stores.documents.all);

  const sortByOptions: ICustomDropdownItem[] = sortOptions.map((option)=>({
    text: option,
    onClick: () => setSortBy(option)
  }));

  useEffect(() => {
    console.log("useEffect triggered with sortedAll:", sortedAll);
    console.log("\tsortedAll.length:", sortedAll.length);
    if (sortBy === "Group") {
      console.log("\tlets sort by group!");
      setSortedAll(sortByGroup(sortable));
      console.log("\tsortedAll: ", sortedAll);
    } else {
      console.log("implement sortByStudents!");
      // Add your additional code here
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, stores.documents.all.length]);




  return (
    <div key="sort-work-view" className="sort-work-view">
      <SortWorkHeader sortBy={sortBy} sortByOptions={sortByOptions} />

      <hr/>
      --------------------All Documents------------------------------
      {
        stores.documents.all.map((doc:any, idx: number) => {
          return (
            <pre style={{padding:0, margin:0}} key={`${doc.key-idx}`}>
              {doc.key} | group: {doc.groupId ?? "_"} | user: {doc.uid} | {doc.type}
            </pre>
          );
        })
      }
      ----------------------Sorted-----------------------------------
      {
        sortedAll.map((doc:any, idx: number) => {
          console.log("doc:", doc);
          return (
            <pre style={{padding:0, margin:0}} key={`${doc.key-idx}`}>
              {doc.key} | group: {doc.groupId ?? "_"} | user: {doc.uid} | {doc.type}
            </pre>
          );
        })
      }
    </div>
  );
});

