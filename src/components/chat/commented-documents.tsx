import React, { useEffect, useState } from "react";
import { useFirestore } from "../../hooks/firestore-hooks";
import { CurriculumDocument } from "../../lib/firestore-schema";
import { getSectionTitle } from "../../models/curriculum/section";
import { UserModelType } from "../../models/stores/user";

interface IProps {
  documentObj: CurriculumDocument,
  user?: UserModelType
}

// Not sure this is the best way to do this.  The issue, I think
// Is that the promises Firebase returns are not visible to TypeScript compiler
// which can't see that the docs will eventually have the fields that match a CurriculumDocument
interface PromisedCurriculumDocument extends CurriculumDocument {
  id?: string,
  title?: string,
  numComments?: number,
}

export const CommentedDocuments: React.FC<IProps> = ({documentObj, user}) => {

  // This is not good.  I am doing this to handle the case when this component exists
  // before the current problem is defined.  It breaks the rules of hooks though.
  if (!documentObj){
    return <>loading</>;
  }

  const [docsCommentedOn, setDocsCommentedOn] = useState<PromisedCurriculumDocument[]>();

  const [db] = useFirestore();
  const cDocsRef = db.collection("curriculum");
  const { unit, problem } = documentObj ;
  const cDocsInScopeRef = cDocsRef
    .where("unit", "==", unit)
    .where("problem", "==", problem)
    .where("network","==", user?.network);

  useEffect(() => {
    const unsubscribeFromDocs = cDocsInScopeRef.onSnapshot(querySnapshot => {
      let docs = querySnapshot.docs.map(doc => {
        // const firstCharPosition = doc.id.split("_", 4).join("_").length + 1; //first char after 4th _
        // const sectionType =  doc.id.substring(firstCharPosition, doc.id.length);
        // console.log("line 43", doc.data());
        return (
          {
            id: doc.id,
            title: "boooo",
            ...doc.data()
          }
        );
      });

      console.log("unsubscribeFromDocs are", unsubscribeFromDocs);
      // console.log("docs are", docs);

      let commentedDocs: PromisedCurriculumDocument[] = [];

      docs.forEach((doc) => {
        const docCommentsRef = cDocsRef.doc(doc.id).collection("comments");
        docCommentsRef.get().then((qs) => {
          if (qs.empty === false){
            //could look at qs size/length to find # of comments - qs.size
            const firstCharPosition = doc.id.split("_", 4).join("_").length + 1; //first char after 4th _

            const sectionType =  doc.id.substring(firstCharPosition, doc.id.length);
            doc = {...doc, title: getSectionTitle(sectionType)};

            console.log("doc:", doc, "typeof", typeof doc);


            console.log("qs", qs);
            commentedDocs.push(doc as PromisedCurriculumDocument);
          }
        });
      });
      console.log("commentedDocs in forEach line 50", commentedDocs);
      setDocsCommentedOn(commentedDocs);
    });
    return () => unsubscribeFromDocs?.();

  },[]);

  return (
    <div>
      {console.log("documentView\n (docsCommentedOn) is ", docsCommentedOn)}
      {
        docsCommentedOn &&
        (docsCommentedOn).map((doc: PromisedCurriculumDocument, index:number) => {
          return <div key={index}> { doc.title } </div>;
        })
      }
    </div>


  );
};
