import React, { useEffect, useState } from "react";
import { useStores, useUIStore} from "../../hooks/use-stores";
import { useFirestore } from "../../hooks/firestore-hooks";
import { CurriculumDocument, DocumentDocument } from "../../lib/firestore-schema";
import { getSectionTitle } from "../../models/curriculum/section";
import { UserModelType } from "../../models/stores/user";
import "./commented-documents.scss";
import { string } from "@concord-consortium/mobx-state-tree/dist/internal";

interface IProps {
  documentObj: CurriculumDocument,
  user?: UserModelType
  handleDocView: (() => void) | undefined;
}

// Not sure this is the best way to do this.  The issue, I think
// Is that the promises Firebase returns are not visible to TypeScript compiler
// which can't see that the docs will eventually have the fields that match a CurriculumDocument
interface PromisedCurriculumDocument extends CurriculumDocument {
  id?: string,
  title?: string,
  numComments?: number
}

interface PromisedDocumentDocument extends DocumentDocument {
  id?: string,
  numComments?: number,
  title: string
}


export const CommentedDocuments: React.FC<IProps> = ({documentObj, user, handleDocView}) => {
  console.log("----- < CommentedDocuments > -----------");
  console.log("documentObj:", documentObj);
  console.log("user:", user);
  console.log("handleDocView:", handleDocView);


  const [docsCommentedOn, setDocsCommentedOn] = useState<PromisedCurriculumDocument[]>();
  const [db] = useFirestore();
  const cDocsRef = db.collection("curriculum");
  const { unit, problem } = documentObj ;
  const cDocsInScopeRef = cDocsRef
    .where("unit", "==", unit)
    .where("problem", "==", problem)
    .where("network","==", user?.network);


  //MyWork/ClassWork
  const [myWorkDocuments, setMyWorkDocuments] = useState<PromisedDocumentDocument[]>();
  const mDocsRef = db.collection("documents");
  const mDocsInScopeRef = mDocsRef.where("network", "==", user?.network);
  const ui = useUIStore();
  const store = useStores();

  //Curriculum Documents
  useEffect(() => {
    console.log("---in useEffect 1-----");
    const t0 = performance.now();
    const unsubscribeFromDocs = cDocsInScopeRef.onSnapshot(async querySnapshot => {
      // console.log("querySnapshot1: ", querySnapshot);
      // console.log("querySnapshot1 docs", querySnapshot.docs);
      // console.log("size of querySnapshots.docs:", querySnapshot.docs.length);
      const docs = querySnapshot.docs.map(doc => {
        console.log("doc line 60:", doc);
        return (
          {
            id: doc.id,
            title: "temp",
            numComments: 0,
            ...doc.data()
          }
        );
      });
      const commentedDocs: PromisedCurriculumDocument[] = [];
      for (let doc of docs){
        // console.log("doc line 73:", doc);
        const docCommentsRef = cDocsRef.doc(doc.id).collection("comments");
        // console.log("docCommentsRef:", docCommentsRef);
        await docCommentsRef.get().then((qs) => {
          // console.log("qs1:", qs);
          if (qs.empty === false) {
            const firstCharPosition = doc.id.split("_", 4).join("_").length + 1; //first char after 4th _
            const sectionType =  doc.id.substring(firstCharPosition, doc.id.length);
            doc = {...doc, title: getSectionTitle(sectionType), numComments: qs.size};
            commentedDocs.push(doc as PromisedCurriculumDocument);
          }
        });
      }
      setDocsCommentedOn(commentedDocs);
      // console.log("size of commentedDocs", commentedDocs.length);
      const t1 = performance.now();
      console.log(`Call to useEffect1 took ${t1 - t0} milliseconds.`);
      console.log("-------end useEffect 1----------");

    });
    return () => unsubscribeFromDocs?.();

  },[]);

  //MyWork/ClassWork
  useEffect(() => {
    console.log("-----in useEffect 2----------");
    const t0 = performance.now();
    console.log("t0 useEffect 2:", t0);
    const unsubscribeFromDocs = mDocsInScopeRef.onSnapshot(async querySnapshot=>{
      const docs = querySnapshot.docs.map(doc =>{ //convert each element of docs to an object
        return (
          {
            id: doc.id,
            type: doc.data().type,
            numComments: 0,
            title: "temp",
            ...doc.data()//this isn't properly getting added to the object
          }
        );
      });
      const commentedDocs: PromisedDocumentDocument[]= [];

      for (let doc of docs){
        let title: string;
        switch (doc.type){
          case "problem":
            title = store.problem.title;
            break;
          case "planning":
            title = `${store.problem.title}: Planning`;
            // console.log("line 119", store.problem.title, store.problemPath, store.problem.subtitle);
            break;
          case "learningLog":
          case "personal":
            title = doc.title;
            break;
        }
        const docCommentsRef = mDocsRef.doc(doc.id).collection("comments");
        await docCommentsRef.get().then((qs)=>{
          if (qs.empty === false){
            doc = {...doc, title, numComments: qs.size};
            commentedDocs.push(doc as PromisedDocumentDocument);
          }
        });
      }
      setMyWorkDocuments(commentedDocs);
      const t1 = performance.now();
      console.log("useEffect 2 t1:", t1);
      console.log(`Call to useEffect2 took ${t1 - t0} milliseconds.`);
      console.log("-------end useEffect 2---------");
    });
    return () => unsubscribeFromDocs?.();
  },[]);

  if (!documentObj){
    return <>loading</>;
  }

  return (
    <div>
      {
        docsCommentedOn &&
        (docsCommentedOn).map((doc: PromisedCurriculumDocument, index:number) => {
          let navTab: string;
          if (doc.id?.includes("guide")){
            navTab = "teacher-guide";
          }
          else {
            navTab = "problems";
          }
          return (
            <div
              className={"document-box"}
              key={index}
              onClick={() => {
                ui.setActiveNavTab(navTab); //open correct NavTab
                ui.setSelectedTile();
                ui.setFocusDocument(doc.path);
                if (handleDocView !== undefined){
                  handleDocView();
                }
              }}
            >
              <div className={"title"}>
                { doc.unit.toUpperCase() + " " + doc.problem + " " + doc.title}
              </div>
              <div className={"numComments"}>
                {doc.numComments}
              </div>
            </div>
          );
        })
      }
      {
        myWorkDocuments &&
        (myWorkDocuments).map((doc: PromisedDocumentDocument, index: number) =>{
          return (
            <div
              className={"document-box"}
              key={index}
              onClick={()=>{
                console.log("clicked a mywork/classwork doc");
              }}
            >
              <div className={"title"}>
                {doc.title}
              </div>
              <div className={"numComments"}>
                {doc.numComments}
              </div>
            </div>
          );
        })

      }
    </div>


  );
};
