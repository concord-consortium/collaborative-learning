import stringify from "json-stringify-pretty-compact";
import React from "react";
import { useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import "./document-error.scss";

interface IProps {
  action: "loading" | "rendering";
  document?: DocumentModelType;
  errorMessage?: string;
  content?: object;
}
export const DocumentError: React.FC<IProps> = ({ action, document, errorMessage, content }) => {
  const {user, db: {firebase} } = useStores();

  const path = document && firebase?.getFullDocumentPath(document, user);
  return (
    <div className="document-error" data-testid="document-error">
      <h1>Error {action} the document</h1>
      {document ?
        <ul>
          <li>Key: &quot;{document.key}&quot;</li>
          <li>User ID (uid): {document.uid}</li>
          <li>Remote Context: {document.remoteContext}</li>
          <li>Type: &quot;{document.type}&quot;</li>
          { path && <li>Path: {path}</li> }
        </ul> :
        <div>Unknown document</div>
      }
      {errorMessage &&
        <>
          <h2>Error Message</h2>
          <pre>{errorMessage}</pre>
        </>
      }
      {content &&
        <>
          <h2>Document Content</h2>
          <pre>{stringify(content, {maxLength: 150})}</pre>
        </>
      }
    </div>
  );
};
