import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import React, { useEffect, useState } from "react";
import { SortWorkHeader } from "../navigation/sort-work-header";
import { ICustomDropdownItem } from "../../clue/components/custom-select";

import "./sort-work-view.scss";

/*
groupA
  abc123
  123cdf



*/
  /* modelling after DocumentCollectionByType (documents-type-collection.tsx):
      0 get the groups and the users - the user ids of the members of the group
      with those user ids now you can go through all the documents already in the store,

      For the sorting...we will need more data per document so that we can group them
      for each (document):
          we need a record that is accurate:
          documentId | userId | groupId (only if problem) |

          at the moment we are in the sort, assume student abc123 is is in the group they are in for this problem
          so their personal docs will show up in that group

      every document where the user id is in the list of ids from the group

      so we don't want to use the group info from the document object itself and just use the group

      1 map out to a flat array of all the docs of each user from each group
      2 render those from stores
      3 ensure handlers are working, perhaps moving some dowen chain (already done with delete, eg)
  */

const sortByGroup = (docs: any) => {
  console.log("-----sorting!!! ----------");
  const groupIds = docs.filter((doc: any) => doc.groupId !== undefined)//first remove teacher documents
                       .map((doc: any) => doc.groupId);

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


   /*
      Teacher 1 should always see all these problem docs
      http://localhost:8080/?appMode=demo&demoName=Joe3&fakeClass=1&fakeUser=teacher:1&problem=1.1&unit=example-config-subtabs&curriculumBranch=sort-tab-dev-2

      Student 1 Problem 1.1 Problem Doc Id:  -Nm2E86RJYoagsLIteUv
      Student 1 Problem 1.2 Problem Doc Id:  -Nm2EEE2Qls7M05heC85

      Student 2 Problem 1.1 Problem Doc Id:  -Nm2G2CazXEYa1cjVLjc
      Student 2 Problem 1.2 Problem Doc Id:  -Nm2Fv8sSwYFit1RIYMi

   */

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

