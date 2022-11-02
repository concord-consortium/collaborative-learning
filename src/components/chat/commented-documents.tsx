import React, { useEffect, useState } from "react";
import { useUIStore} from "../../hooks/use-stores";
import { useFirestore } from "../../hooks/firestore-hooks";
import { CurriculumDocument } from "../../lib/firestore-schema";
import { getSectionTitle } from "../../models/curriculum/section";
import { UserModelType } from "../../models/stores/user";
import "./commented-documents.scss";

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
  numComments?: number,
}

export const CommentedDocuments: React.FC<IProps> = ({documentObj, user, handleDocView}) => {
  const [docsCommentedOn, setDocsCommentedOn] = useState<PromisedCurriculumDocument[]>();
  const [db] = useFirestore();
  const cDocsRef = db.collection("curriculum");
  const { unit, problem } = documentObj ;
  const cDocsInScopeRef = cDocsRef
    .where("unit", "==", unit)
    .where("problem", "==", problem)
    .where("network","==", user?.network);
  const ui = useUIStore();

  useEffect(() => {
    const unsubscribeFromDocs = cDocsInScopeRef.onSnapshot(async querySnapshot => {
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

      for (let doc of docs){
        const docCommentsRef = cDocsRef.doc(doc.id).collection("comments");
        await docCommentsRef.get().then((qs) => {
          if (qs.empty === false) {
            const firstCharPosition = doc.id.split("_", 4).join("_").length + 1; //first char after 4th _
            const sectionType =  doc.id.substring(firstCharPosition, doc.id.length);
            doc = {...doc, title: getSectionTitle(sectionType), numComments: qs.size};
            commentedDocs.push(doc as PromisedCurriculumDocument);
          }
        });
      }
      setDocsCommentedOn(commentedDocs);
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
    </div>


  );
};
