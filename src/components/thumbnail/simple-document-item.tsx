import React from "react";
import { IDocumentMetadata } from "../../../shared/shared";
import { useStores } from "../../hooks/use-stores";
import { isDocumentAccessibleToUser } from "../../models/document/document-utils";

import "./simple-document-item.scss";

interface IProps {
  document: IDocumentMetadata;
  investigationOrdinal: string;
  problemOrdinal: string;
  onSelectDocument: (document: IDocumentMetadata) => void;
}

export const SimpleDocumentItem = ({ document, investigationOrdinal, onSelectDocument, problemOrdinal }: IProps) => {
  const { documents, class: classStore, unit, user } = useStores();
  const { uid } = document;
  const userName = classStore.getUserById(uid)?.displayName;
  // TODO: Make it so we don't have to convert investigationOrdinal and problemOrdinal to numbers here? We do so
  // because the values originate as strings. Changing their types to numbers in the model would make this unnecessary,
  // but doing that causes errors elsewhere when trying to load documents that aren't associated with a problem.
  const investigation = unit.getInvestigation(Number(investigationOrdinal));
  const problem = investigation?.getProblem(Number(problemOrdinal));
  const title = document.title ? `${userName}: ${document.title}` : `${userName}: ${problem?.title ?? "unknown title"}`;
  const isPrivate = !isDocumentAccessibleToUser(document, user, documents);

  const handleClick = () => {
    onSelectDocument(document);
  };

  return (
    <div
      className={isPrivate ? "simple-document-item private" : "simple-document-item"}
      data-test="simple-document-item"
      title={title}
      onClick={!isPrivate ? handleClick : undefined}
    >
    </div>
  );
};
