import React, { useEffect, useState } from "react";
import { useUIStore, useStores } from "../../hooks/use-stores";
import { useFirestore } from "../../hooks/firestore-hooks";
import { CurriculumDocument } from "../../lib/firestore-schema";
import { getSectionTitle } from "../../models/curriculum/section";
import { UserModelType } from "../../models/stores/user";
import "./commented-documents.scss";

interface IProps {
  documentObj: CurriculumDocument,
  user?: UserModelType
  handleDocumentClick: () => void;
}

// Not sure this is the best way to do this.  The issue, I think
// Is that the promises Firebase returns are not visible to TypeScript compiler
// which can't see that the docs will eventually have the fields that match a CurriculumDocument
interface PromisedCurriculumDocument extends CurriculumDocument {
  id?: string,
  title?: string,
  numComments?: number,
}

export const CommentedDocuments: React.FC<IProps> = ({documentObj, user, handleDocumentClick}) => {
  // console.log("<CommentedDocuments> with args", documentObj, user)
  const [docsCommentedOn, setDocsCommentedOn] = useState<PromisedCurriculumDocument[]>();
  const [db] = useFirestore();
  const cDocsRef = db.collection("curriculum");
  const { unit, problem } = documentObj ;
  const cDocsInScopeRef = cDocsRef
    .where("unit", "==", unit)
    .where("problem", "==", problem)
    .where("network","==", user?.network);
  const ui = useUIStore();
  const stores = useStores();

  useEffect(() => {

    const unsubscribeFromDocs = cDocsInScopeRef.onSnapshot(querySnapshot => {
      // console.log("querySnapshot.docs is", querySnapshot.docs);
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
      docs.forEach((doc) => {
        const docCommentsRef = cDocsRef.doc(doc.id).collection("comments");
        docCommentsRef.get().then((qs) => {
          if (qs.empty === false){
            //could look at qs size/length to find # of comments - qs.size
            const firstCharPosition = doc.id.split("_", 4).join("_").length + 1; //first char after 4th _
            const sectionType =  doc.id.substring(firstCharPosition, doc.id.length);
            doc = {...doc, title: getSectionTitle(sectionType), numComments: qs.size};
            commentedDocs.push(doc as PromisedCurriculumDocument);
          }
        });
      });
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
                ui.setActiveNavTab(navTab); //open tab
                ui.setSelectedTile();
                ui.setFocusDocument(doc.path);
                switch (navTab){
                  case "problems":
                    ui.setSelectedSectionIndex(doc.section, stores.problem.sections);
                    break;
                  case "teacher-guide":
                    ui.setSelectedSectionIndex(doc.section, stores.teacherGuide?.sections);
                    break;
                }
                handleDocumentClick();


              }}
            >
              <div className={"title"}>
                { doc.title }
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
