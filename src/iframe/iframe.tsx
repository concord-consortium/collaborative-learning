import React from "react";
import ReactDOM from "react-dom";

import { IframeDocumentEditor } from "./iframe-document-editor";
import { DocumentModelType } from "../models/document/document";

let initialValue = undefined as DocumentModelType | undefined;

const urlParams = new URLSearchParams(window.location.search);
const noBorder = urlParams.get("noBorder") === "true";
const fullHeight = urlParams.get("fullHeight") === "true";

const resizeObserver = new ResizeObserver((elements) => {
  window.parent.postMessage({ type: "updateHeight", height: document.body.scrollHeight}, "*");
});

(window as any).addEventListener("message", (event: MessageEvent) => {
  if (event.data.initialValue) {
    initialValue = JSON.parse(event.data.initialValue);
    // add a resize observer to send the height the iframe needs
    resizeObserver.observe(document.body);
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
      <IframeDocumentEditor
        initialValue={initialValue}
        handleUpdateContent={handleUpdateContent}
        fullHeight={fullHeight}
        noBorder={noBorder}
      />
    </div>,
    document.getElementById("app")
  );
};
