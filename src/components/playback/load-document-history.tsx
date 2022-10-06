import React, { useEffect } from "react";
import { useDocumentHistory } from "../../hooks/document-comment-hooks";
import { useUserStore } from "../../hooks/use-stores";
import { CDocument, TreeManagerType } from "../../models/history/tree-manager";
import { DocumentModelType } from "../../models/document/document";

interface IProps {
  document?: DocumentModelType,
}

export const LoadDocumentHistory: React.FC<IProps> = ({ document }) => {
  const user = useUserStore();

  const otherUserDocument = user.id !== document?.uid;

  const { data, isLoading, isSuccess, isError, status } = 
    useDocumentHistory(document?.key, otherUserDocument ? document?.uid : undefined);
  
  // Default message
  let message = `Unknown status ${status}`;
  if (isLoading) {
    message = "Loading history...";
  }

  if (isError) {
    message = "Error loading history";
  }

  useEffect(() => {
    if (isSuccess) {
      // Take the firestore documents from data and put them into the document
      // This is in a useEffect because it is modifying state and that should
      // never be done in the main render of the component.
      // FIXME-HISTORY: this approach probably does not handle paging well, 
      // and I'd suspect we'll have a lot of changes so we'll need to handle that.
      // https://www.pivotaltracker.com/story/show/183291353
      // FIXME-HISTORY: we should protect active documents so that if they are accidentally
      // passed to this component we don't replace their history. I think that means
      // adding a prop to documents so we can identify documents that are being
      // used for history replaying
      // https://www.pivotaltracker.com/story/show/183291353
      const treeManager = document?.treeManagerAPI as TreeManagerType;
      const cDocument = CDocument.create({history: data});
      treeManager.setChangeDocument(cDocument);
      treeManager.setCurrentHistoryIndex(cDocument.history.length);
    }
  });

  // If this is still being displayed after loading the history, then no history was found
  // css classes used here are defined in playback-control.scss
  return (
      <div className="playback-controls loading">
        {isSuccess ? "This document has no history." : message}
      </div>
    );

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
