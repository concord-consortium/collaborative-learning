import React, { useEffect } from "react";
import { useDocumentHistory } from "../../hooks/document-comment-hooks";
import { CDocument, TreeManagerType } from "../../models/history/tree-manager";
import { DocumentModelType } from "../../models/document/document";

interface IProps {
  document?: DocumentModelType,
  viaTeacherDashboard?: boolean
}

export const LoadDocumentHistory: React.FC<IProps> = ({ document, viaTeacherDashboard }) => {
  const { data, isLoading, isSuccess, isError, status} = 
    useDocumentHistory(document?.key, viaTeacherDashboard ? document?.uid : undefined);

  // TODO: hacky style to make loading visible
  const style: any = { 
    position: "absolute", 
    top: "100px", 
    left: "20px", 
    background: "white", 
    fontSize: "x-large"
  };
  
  // Default message
  let message = `Unknown status ${status}`;
  if (isLoading) {
    message = "Loading...";
  }

  if (isError) {
    message = "Error loading doc history";
  }

  useEffect(() => {
    if (isSuccess) {
      // Take the firestore documents from data and put them into the document
      // This is put in a useEffect because it is modifying state and that should
      // never be done in the main render of the component.
      // FIXME: this approach probably does not handle paging well, 
      // and I'd suspect we'll have a lot of changes so we'll need to handle that.
      // FIXME: we should protect active documents so that if they are accidentally
      // passed to this component we don't replace their history. I think that means
      // adding a prop to documents so we can identify documents that are for being
      // used for history replaying
      const treeManager = (document?.treeManagerAPI as TreeManagerType);
      const cDocument = CDocument.create({history: data});
      treeManager.setChangeDocument(cDocument);
      treeManager.setCurrentHistoryIndex(cDocument.history.length);
    }
  });

  // We don't need to display if we are loaded
  return isSuccess ? null : <div style={style}>{message}</div>;

  // TODO: what do we do about component caching, if the history button is clicked 
  // more than once perhaps it won't re-read the history.
  // It'd be better to be optimistic when doing this locally so we can show the 
  // local history while the remote history is being loaded in.
  // However, Firestore should do this for us essentially, it should return the 
  // locally cached docs first.
  // The next question is how the onSnapshot of useDocumentHistory will respond when
  // new documents show up. If useQuery uses something like useState then this will
  // trigger this component to re-render and then update the state. So then the
  // history will update as soon as the user changes the document, this will probably 
  // break the history slider UI but lets find out...
};
