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
  // A document several people edit together is owned by a synthetic uid — `group_<offeringId>_<groupId>` or
  // `class_<classHash>` — which is no member of the class, so there is no name to put in front of it. Its
  // title already says whose it is ("Group 1 Document"). A title can also be absent, so join whichever parts
  // resolve rather than interpolating both.
  const titleWithUser = [userName, title].filter(Boolean).join(": ");
  const isPrivate = !isDocumentAccessibleToUser({ documentMetadata: document, user, documents });
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
      data-document-key={document.key}
      title={titleWithUser}
      type="button"
      onClick={handleClick}
    />
  );
});
