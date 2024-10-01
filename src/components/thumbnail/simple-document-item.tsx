import { observer } from "mobx-react";
import React from "react";
import { IDocumentMetadataModel } from "../../models/stores/sorted-documents";
import { useStores } from "../../hooks/use-stores";
import { getDocumentDisplayTitle, isDocumentAccessibleToUser } from "../../models/document/document-utils";

import "./simple-document-item.scss";

interface IProps {
  document: IDocumentMetadataModel;
  onSelectDocument: (document: IDocumentMetadataModel) => void;
}

export const SimpleDocumentItem = observer(function SimpleDocumentItem(
  { document, onSelectDocument }: IProps
) {
  const { appConfig, documents, class: classStore, unit, user } = useStores();
  const { uid } = document;
  const userName = classStore.getUserById(uid)?.displayName;
  const title = getDocumentDisplayTitle(unit, document, appConfig);
  const titleWithUser = `${userName}: ${title}`;
  const isPrivate = !isDocumentAccessibleToUser(document, user, documents);

  const handleClick = () => {
    onSelectDocument(document);
  };

  return (
    <div
      className={isPrivate ? "simple-document-item private" : "simple-document-item"}
      data-test="simple-document-item"
      title={titleWithUser}
      onClick={!isPrivate ? handleClick : undefined}
    >
    </div>
  );
});
