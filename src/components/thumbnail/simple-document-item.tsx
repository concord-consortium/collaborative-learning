import React from "react";
import { IDocumentMetadata } from "../../../functions/src/shared";
import { useStores } from "../../hooks/use-stores";

import "./simple-document-item.scss";

interface IProps {
  document: IDocumentMetadata;
  investigationOrdinal: string;
  problemOrdinal: string;
  onSelectDocument: (document: IDocumentMetadata) => void;
}

export const SimpleDocumentItem = ({ document, investigationOrdinal, onSelectDocument, problemOrdinal }: IProps) => {
  const { class: classStore, unit } = useStores();
  const { uid } = document;
  const userName = classStore.getUserById(uid)?.displayName;
  const investigations = unit.investigations;
  const investigation = investigations[Number(investigationOrdinal)];
  const problem = investigation?.problems[Number(problemOrdinal) - 1];
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
