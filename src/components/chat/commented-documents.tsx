import React, { useEffect, useState } from "react";
import { useStores, useUIStore} from "../../hooks/use-stores";
import { useFirestore } from "../../hooks/firestore-hooks";
import { CurriculumDocument, DocumentDocument } from "../../lib/firestore-schema";
import { getSectionTitle } from "../../models/curriculum/section";
import { UserModelType } from "../../models/stores/user";
import "./commented-documents.scss";
interface IProps {
  documentObj: CurriculumDocument,
  user?: UserModelType
  handleDocView: (() => void) | undefined;
}
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
  // console.log("documentObj:", documentObj);
  // console.log("user:", user);
  // console.log("handleDocView:", handleDocView);
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
  const mDocsInScopeRef = mDocsRef
    .where("network", "==", user?.network); //do we want to filter by demo class 1?
    // .where("context_id", "==", "democlass1");
  const ui = useUIStore();
  const store = useStores();

  //------Curriculum Documents--------
  useEffect(() => {
    // console.log("---in useEffect 1-----");
    // const t0 = performance.now();
    const unsubscribeFromDocs = cDocsInScopeRef.onSnapshot(querySnapshot => {
      const docs = querySnapshot.docs.map(doc => {
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
      const promiseArr: Promise<void>[] = [];
      for (let doc of docs){
        const docCommentsRef = cDocsRef.doc(doc.id).collection("comments");
        promiseArr.push(docCommentsRef.get().then((qs) => {
          if (qs.empty === false) {
            const firstCharPosition = doc.id.split("_", 4).join("_").length + 1; //first char after 4th _
            const sectionType =  doc.id.substring(firstCharPosition, doc.id.length);
            doc = {...doc, title: getSectionTitle(sectionType), numComments: qs.size};
            commentedDocs.push(doc as PromisedCurriculumDocument);
          }
        }));
      }
      Promise.all(promiseArr).then((results)=>{
        setDocsCommentedOn(commentedDocs);
      }).then(()=>{
        // const t1 = performance.now();
        // console.log(`Call to useEffect1 took ${t1 - t0} milliseconds.`);
      });
      // console.log("-------end useEffect 1----------");
    });
    return () => unsubscribeFromDocs?.();
  },[]);

  // ------MyWork/ClassWork--------
  useEffect(() => {
    //-------promise.all -----------
    const t0 = performance.now();
    const unsubscribeFromDocs = mDocsInScopeRef.onSnapshot(querySnapshot=>{
      const docs = querySnapshot.docs.map(doc =>{ //convert each element of docs to an object
        console.log("line 103 doc:", doc.data());
        return (
          {
            id: doc.id,
            type: doc.data().type,
            numComments: 0,
            title: "temp",
            ...doc.data()
          }
        );
      });
      const commentedDocs: PromisedDocumentDocument[]= [];
      const promiseArr: Promise<void>[]=[];
      for (let doc of docs){
        let title: string;
        console.log("line 118 doc.type:", doc.type);
        switch (doc.type){
          case "problem":
            title = store.problem.title;
            break;
          case "planning":
            title = `${store.problem.title}: Planning`;
            break;
          case "learningLog":
          case "personal":
            title = doc.title;
            break;
          case "publication":
            console.log("----case publication------");
            console.log("publication doc", doc);
            console.log(store.documents.getDocument);
            console.log(store.documents.getNextLearningLogTitle);
            console.log(store.documents.getNextOtherDocumentTitle);
            console.log(store.documents.getNextPersonalDocumentTitle);
            console.log("----end case publication------");

            break;
          // types I have not accounted for :
          //publication, learningLogPublication, personalPublication, supportPublication
        }
        const docCommentsRef = mDocsRef.doc(doc.id).collection("comments");
        promiseArr.push(docCommentsRef.get().then((qs)=>{
          if (qs.empty === false){
            doc = {...doc, title, numComments: qs.size};
            commentedDocs.push(doc as PromisedDocumentDocument);
          }
        }));
      }

      Promise.all(promiseArr).then(()=>{
        setMyWorkDocuments(commentedDocs);
      }).then(()=>{
        const t1 = performance.now();
        console.log("useEffect 2: commentedDocs", commentedDocs);
        console.log("useEffect 2 t1:", t1);
        console.log(`Call to useEffect2 took ${t1 - t0} milliseconds.`);
      });
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
          console.log("doc.id line 163", doc.id);
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
          console.log("doc.id line 196:", doc.id);
          console.log("doc.title line 197:", doc.title);
          console.log("doc:", doc);
          return (
            <div
              className={"document-box"}
              key={index}
              onClick={()=>{
                console.log("clicked a mywork/classwork doc");
                console.log("line 200", doc.title);
                //is it true that mywork tab only holds Problem, Planning, Personal (you make), Learning?
                //class work holds .... publication, learningLogPublication, personalPublication, supportPublication?
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
