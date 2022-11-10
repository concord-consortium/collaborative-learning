import React, { useEffect, useState } from "react";
import { useStores, useUIStore} from "../../hooks/use-stores";
import { useFirestore } from "../../hooks/firestore-hooks";
import { CurriculumDocument, DocumentDocument } from "../../lib/firestore-schema";
import { getSectionTitle } from "../../models/curriculum/section";
import { UserModelType } from "../../models/stores/user";
import { DocumentModelType } from "../../models/document/document";
import { useDocumentCaption } from "../thumbnail/decorated-document-thumbnail-item";
import { ENavTab } from "../../models/view/nav-tabs";
import DocumentIcon from "../../assets/icons/document-icon.svg";

import "./commented-documents.scss";
import { getProblemOrdinal } from "../../models/stores/stores";

interface IProps {
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
  title?: string
}

export const CommentedDocuments: React.FC<IProps> = ({user, handleDocView}) => {
  const [db] = useFirestore();
  const ui = useUIStore();
  const store = useStores();
  const problem =  getProblemOrdinal(store);
  const unit = store.unit.code;

  //"Problem"/"Teacher-Guide"
  const [docsCommentedOn, setDocsCommentedOn] = useState<PromisedCurriculumDocument[]>();
  const cDocsRef = db.collection("curriculum");
  const cDocsInScopeRef = cDocsRef
    .where("unit", "==", unit)
    .where("problem", "==", problem)
    .where("network","==", user?.network);

  //"MyWork"/"ClassWork"
  const [myWorkDocuments, setMyWorkDocuments] = useState<PromisedDocumentDocument[]>();
  const mDocsRef = db.collection("documents");
  const mDocsInScopeRef = mDocsRef
    .where("network", "==", user?.network);

  //------Curriculum Documents--------
  useEffect(() => {
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
      });
    });
    return () => unsubscribeFromDocs?.();
  },[]);

  // ------MyWork/ClassWork--------
  useEffect(() => {
    const unsubscribeFromDocs = mDocsInScopeRef.onSnapshot(querySnapshot=>{
      const docs = querySnapshot.docs.map(doc =>{ //convert each element of docs to an object
        return (
          {
            id: doc.id,
            type: doc.data().type,
            numComments: 0,
            title: "temp",
            key: doc.data().key,
            ...doc.data()
          }
        );
      });
      const commentedDocs: PromisedDocumentDocument[]= [];
      const promiseArr: Promise<void>[]=[];
      for (let doc of docs){
        const docCommentsRef = mDocsRef.doc(doc.id).collection("comments");
        promiseArr.push(docCommentsRef.get().then((qs)=>{
          if (qs.empty === false){
            doc = {...doc, numComments: qs.size};
            commentedDocs.push(doc as PromisedDocumentDocument);
          }
        }));
      }

      Promise.all(promiseArr).then(()=>{
        setMyWorkDocuments(commentedDocs);
      });

    });
    return () => unsubscribeFromDocs?.();
  },[]);

  return (
    <div className="commented-document-list">
      {
        docsCommentedOn &&
        (docsCommentedOn).map((doc: PromisedCurriculumDocument, index:number) => {
          let navTab: string;
          if (doc.id?.includes("guide")){
            navTab = ENavTab.kTeacherGuide;
          }
          else {
            navTab = ENavTab.kProblems;
          }
          return (
            <div
              className={`document-box ${navTab}`}
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
              <div className="document-type-icon">
                <DocumentIcon/>
              </div>
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
          const sectionDoc =  store.documents.getDocument(doc.key);
          const networkDoc = store.networkDocuments.getDocument(doc.key);
          // console.log(`-------map---------${index}----`);
          // console.log("doc: ", doc);
          // console.log("sectionDoc:",sectionDoc);
          // console.log("networkDoc: ", networkDoc);

          if (sectionDoc){
            return (
              <MyWorkDocuments
                key={index}
                doc={doc}
                index={index}
                sectionOrNetworkDoc={sectionDoc}
                isNetworkDoc={false}
                handleDocView={handleDocView}
              />
            );
          }
          if (networkDoc){
            return (
              <MyWorkDocuments
                key={index}
                doc={doc}
                index={index}
                sectionOrNetworkDoc={networkDoc}
                isNetworkDoc={true}
                handleDocView={handleDocView}
              />
            );
          }
        })

      }
    </div>
  );
};

interface JProps {
  doc: any,
  index: number,
  sectionOrNetworkDoc: DocumentModelType | undefined,
  isNetworkDoc: boolean,
  handleDocView: (() => void) | undefined,
}

export const MyWorkDocuments: React.FC<JProps> = ({doc, index, sectionOrNetworkDoc, isNetworkDoc, handleDocView}) => {
  // console.log("MyWorkDocuments with doc:", doc);
  // console.log("sectionOrNetworkDoc:", sectionOrNetworkDoc);

  const ui = useUIStore();
  let navTab = '';
  const myWorkTypes = ["problem", "planning", "learningLog", "personal"];
  const classWorkTypes = ["publication", "learningLogPublication", "personalPublication", "supportPublication"];
  for (let i = 0; i < 4; i++){
    if (doc.type === myWorkTypes[i]){
      navTab = ENavTab.kMyWork;
    }
    if (doc.type === classWorkTypes[i]){
      navTab = ENavTab.kClassWork;
    }
  }
  const title =  useDocumentCaption(sectionOrNetworkDoc as DocumentModelType);
  //to do : add the download hook to download network docs
  // add yellow div behind the svg

  return (
    <div
      className={`document-box my-work-document ${navTab}`}
      onClick={()=>{
        ui.setActiveNavTab(navTab); //open correct NavTab
        ui.setSelectedTile();
        ui.setSelectedCommentedDocument(sectionOrNetworkDoc?.key);
        ui.setFocusDocument(sectionOrNetworkDoc?.key);
        if (handleDocView !== undefined){
          handleDocView();
        }
      }}
    >
    {
      isNetworkDoc ?
        <>
          <div className="document-type-icon">
            <DocumentIcon/>
          </div>
          <div className={"yellow-background"}>
          </div>
        </>
      :
      <div className="document-type-icon">
        <DocumentIcon/>
      </div>
    }


      <div className={"title"}>
        {title} + {sectionOrNetworkDoc?.key}
      </div>
      <div className={"numComments"}>
        {doc.numComments}
      </div>
    </div>
  );
};
