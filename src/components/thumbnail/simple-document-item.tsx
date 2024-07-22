import React from "react";
import { useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";

import "./simple-document-item.scss";

interface IProps {
  document: DocumentModelType;
  investigationOrdinal: number;
  problemOrdinal: number;
  onSelectDocument: (document: DocumentModelType) => void;
}

export const SimpleDocumentItem = ({ document, investigationOrdinal, onSelectDocument, problemOrdinal }: IProps) => {
  const { class: classStore, unit } = useStores();
  const { uid } = document;
  const userName = classStore.getUserById(uid)?.displayName;
  const investigations = unit.investigations;
  const investigation = investigations[investigationOrdinal];
  const problem = investigation?.problems[problemOrdinal - 1];
  const title = document.title ? `${userName}: ${document.title}` : `${userName}: ${problem?.title ?? "unknown title"}`;
  // TODO: Account for and use isPrivate in the view. isAccessibleToUser won't currently work here.
  // const isPrivate = !document.isAccessibleToUser(user, documents);

  const handleClick = () => {
    onSelectDocument(document);
  };

  return (
    <div
      className="simple-document-item"
      data-test="simple-document-item"
      title={title}
      onClick={handleClick}
    >
    </div>
  );
};
