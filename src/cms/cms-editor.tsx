import React from "react";
import ReactDOM from "react-dom";

import { CmsDocumentEditor } from "./cms-document-editor";
import { DocumentModelType } from "../models/document/document";

let initialValue = undefined as DocumentModelType | undefined;

(window as any).addEventListener("message", (event: MessageEvent) => {
  if (event.data.initialValue) {
    initialValue = JSON.parse(event.data.initialValue);
    if (initialValue) {
      renderEditor();
    }
  } else {
    return null;
  }
});

const handleUpdateContent = (json: Record<string, any>) => {
  const stringifiedJson = JSON.stringify(json);
  window.parent.postMessage({ type: "updateContent", content: stringifiedJson }, "*");
};

const renderEditor = () => {
  ReactDOM.render(
    <div id="app">
      <CmsDocumentEditor initialValue={initialValue} handleUpdateContent={handleUpdateContent} />
    </div>,
    document.getElementById("app")
  );
};
