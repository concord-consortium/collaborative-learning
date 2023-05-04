import React from "react";
import ReactDOM from "react-dom";

import { DocumentEditor } from "./document-editor";
import { DocumentModelType } from "../models/document/document";

let initialValue = undefined as DocumentModelType | undefined;
const validOrigin = `${window.location.protocol}//${window.location.host}`;

(window as any).addEventListener("message", (event: MessageEvent) => {
  if (event.origin === validOrigin && event.data.initialValue) {
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
  window.parent.postMessage({ type: "updateContent", content: stringifiedJson }, validOrigin);
};

const renderEditor = () => {
  ReactDOM.render(
    <div id="app">
      <DocumentEditor initialValue={initialValue} handleUpdateContent={handleUpdateContent} />
    </div>,
    document.getElementById("app")
  );
};
