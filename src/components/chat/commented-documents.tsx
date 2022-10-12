import React, { useEffect, useState } from "react";
import { useFirestore } from "../../hooks/firestore-hooks";
import { CurriculumDocument } from "../../lib/firestore-schema";
import { UserModelType } from "../../models/stores/user";

interface IProps {
  documentObj: CurriculumDocument,
  user?: UserModelType
}

// Not sure this is the best way to do this.  The issue, I think
// Is that the promises Firebase returns are not visible to TypeScript compiler
// which can't see that the docs will eventually have the fields that match a CurriculumDocument
interface PromisedCurriculumDocument extends CurriculumDocument {
  id?: string
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
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      let commentedDocs: PromisedCurriculumDocument[] = [];

      docs.forEach((doc) => {
        const docCommentsRef = cDocsRef.doc(doc.id).collection("comments");
        docCommentsRef.get().then((qs) => {
          if (qs.empty === false){
            commentedDocs.push(doc as PromisedCurriculumDocument);
          }
        });
      });
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
          return <div key={index}> { doc.id } </div>;
        })
      }
    </div>


  );
};
