import { observer } from "mobx-react";
import React from "react";
import { DocumentModelType } from "../../models/document/document";
import { useStores } from "../../hooks/use-stores";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import classNames from "classnames";
import { GroupDocument } from "../../models/document/document-types";

interface IProps {
  document: Maybe<DocumentModelType>;
  hideOwner?: boolean;
  extraTitleClassNames?: classNames.Argument;
}

/**
 * Display the document title. Note this component overlaps with the userDocumentCaption
 * hook.
 */
export const DocumentTitle: React.FC<IProps> = observer(function DocumentTitle(props: IProps) {
  const {appConfig, class: classStore, unit } = useStores();
  const { document, hideOwner, extraTitleClassNames } = props;

  const ownerName = (() => {
    if (!document) {
      return "";
    }
    if (document.type === GroupDocument) {
      // getDocumentDisplayTitle uses the group id as the title so we don't need to
      // duplicate that here.
      return "";
    } else {
      // TODO: getDocumentDisplayTitle already adds a prefix with the user name, so it seems
      // this is going to show the owner name twice. We should clean that up.
      const owner = classStore.users.get(document.uid);
      return owner ? owner.fullName : "";
    }
  }) ();

  // TODO: We might want to change this Unknown to "Title Loading..." since that should be the
  // the case when document is undefined.
  // Also it is possible for getDocumentDisplayTitle to return undefined,
  // perhaps it could return "Untitled" instead, but we need to check that change won't
  // something else before changing it.
  const docTitle =
    !document ? "Unknown" : getDocumentDisplayTitle(unit, document, appConfig);

  return (
    <div className="document-title">
      {(!hideOwner && ownerName)
          && <span className="document-owner">{ownerName}: </span>}
      <span className={classNames("document-title", extraTitleClassNames)}>
        {docTitle}
      </span>
    </div>
  );
});
