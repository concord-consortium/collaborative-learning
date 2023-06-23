import React, { useEffect, useMemo, useState } from "react";
import { useStores, useUIStore} from "../../hooks/use-stores";
import { useFirestore } from "../../hooks/firestore-hooks";
import { CurriculumDocument, DocumentDocument } from "../../lib/firestore-schema";
import { getSectionTitle } from "../../models/curriculum/section";
import { UserModelType } from "../../models/stores/user";
import { getNavTabOfDocument, getTabsOfCurriculumDoc } from "../../models/stores/ui";
import { DocumentModelType } from "../../models/document/document";
import { useDocumentCaption } from "../thumbnail/decorated-document-thumbnail-item";
import DocumentIcon from "../../assets/icons/document-icon.svg";

import "./commented-documents.scss";

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
  const problem =  store.problemOrdinal;
  const unit = store.unit.code;

  //"Problem"/"Teacher-Guide"
  const [docsCommentedOn, setDocsCommentedOn] = useState<PromisedCurriculumDocument[]>();
  const cDocsRef = useMemo(() => db.collection("curriculum"), [db]);
  const cDocsInScopeRef = useMemo(() => (
    cDocsRef
    .where("unit", "==", unit)
    .where("problem", "==", problem)
    .where("network","==", user?.network)
  ), [cDocsRef, problem, unit, user?.network]);

  //"MyWork"/"ClassWork"
  const [workDocuments, setWorkDocuments] = useState<PromisedDocumentDocument[]>();
  const mDocsRef = useMemo(() => db.collection("documents"), [db]);
  const mDocsInScopeRef = useMemo(() => (
    mDocsRef.where("network", "==", user?.network)
  ), [mDocsRef, user?.network]);

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
  },[cDocsRef, cDocsInScopeRef]);

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
        setWorkDocuments(commentedDocs);
      });

    });
    return () => unsubscribeFromDocs?.();
  },[mDocsRef, mDocsInScopeRef]);

  return (
    <div className="commented-document-list">
      {
        docsCommentedOn &&
        (docsCommentedOn).map((doc: PromisedCurriculumDocument, index:number) => {
          const {navTab} = getTabsOfCurriculumDoc(doc.path);
          return (
            <div
              className={`document-box ${navTab}`}
              key={index}
              onClick={() => {
                ui.openCurriculumDocument(doc.path);
                ui.setSelectedTile();
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
        workDocuments &&
        (workDocuments).map((doc: PromisedDocumentDocument, index: number) =>{
          const sectionDoc =  store.documents.getDocument(doc.key);
          const networkDoc = store.networkDocuments.getDocument(doc.key);
          if (sectionDoc){
            return (
              <WorkDocumentItem
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
              <WorkDocumentItem
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
  sectionOrNetworkDoc: DocumentModelType,
  isNetworkDoc: boolean,
  handleDocView: (() => void) | undefined,
}

// This is rendering a single document item in the commented document list
export const WorkDocumentItem: React.FC<JProps> = ({doc, index, sectionOrNetworkDoc, isNetworkDoc, handleDocView}) => {
  const ui = useUIStore();
  // We need the navTab to style the item.
  const navTab = getNavTabOfDocument(doc.type);
  const title =  useDocumentCaption(sectionOrNetworkDoc);

  return (
    <div
      className={`document-box my-work-document ${navTab}`}
      onClick={()=>{
        ui.openResourceDocument(sectionOrNetworkDoc);
        ui.setSelectedTile();
        if (handleDocView !== undefined){
          handleDocView();
        }
      }}
    >
    {
      isNetworkDoc ?
          <div className="document-type-icon-yellow">
            <DocumentIcon/>
            <div className="yellow-background"/>

          </div>
      :
      <div className="document-type-icon">
        <DocumentIcon/>
      </div>
    }


      <div className={"title"}>
        {title}
      </div>
      <div className={"numComments"}>
        {doc.numComments}
      </div>
    </div>
  );
};
