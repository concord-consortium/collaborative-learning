import stringify from "json-stringify-pretty-compact";
import React from "react";
import { ContentStatus, DocumentModelType } from "../../models/document/document";
import "./document-error.scss";

interface IProps {
  document?: DocumentModelType;
}
export const DocumentError: React.FC<IProps> = ({ document }) => {
  if (document?.contentStatus !== ContentStatus.Error) {
    return null;
  }
  return (
    <div className="document-error" data-testid="document-error">
      <h1>Error loading the document</h1>
      <ul>
        <li>Key: &quot;{document.key}&quot;</li>
        <li>User ID (uid): {document.uid}</li>
        <li>Context ID (remoteContext): {document.remoteContext}</li>
        <li>Type: &quot;{document.type}&quot;</li>
      </ul>
      <h2>Error Message</h2>
      <pre>{document.contentErrorMessage}</pre>
      {document.invalidContent &&
        <>
          <h2>Document Content</h2>
          <pre>{stringify(document.invalidContent, { maxLength: 150 })}</pre>
        </>
      }
    </div>
  );
};
