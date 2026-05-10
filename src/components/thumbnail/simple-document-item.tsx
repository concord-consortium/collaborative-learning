import { observer } from "mobx-react";
import React from "react";
import classNames from "classnames";
import { IDocumentMetadataModel } from "../../models/document/document-metadata-model";
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
  const { appConfig, documents, class: classStore, unit, user, ui } = useStores();
  const { uid } = document;
  const userName = classStore.getUserById(uid)?.displayName;
  const title = getDocumentDisplayTitle(unit, document, appConfig);
  const titleWithUser = `${userName}: ${title}`;
  const isPrivate = !isDocumentAccessibleToUser(document, user, documents);
  const selected = ui.highlightedSortWorkDocument === document.key;

  const handleClick = () => {
    if (!isPrivate) onSelectDocument(document);
  };

  return (
    <button
      aria-current={selected ? "true" : undefined}
      aria-disabled={isPrivate || undefined}
      aria-label={titleWithUser}
      className={classNames("simple-document-item", { selected, private: isPrivate })}
      data-test="simple-document-item"
      title={titleWithUser}
      type="button"
      onClick={handleClick}
    />
  );
});
