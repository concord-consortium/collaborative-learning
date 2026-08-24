import React from "react";
import { createRoot, Root } from "react-dom/client";

import { IframeDocumentEditor } from "./iframe-document-editor";
import { postContentHeight, postDocumentRendered } from "./iframe-messages";
import { DocumentModelType } from "../models/document/document";

let initialValue = undefined as DocumentModelType | undefined;

const urlParams = new URLSearchParams(window.location.search);
const noBorder = urlParams.get("noBorder") === "true";
const fullHeight = urlParams.get("fullHeight") === "true";

const resizeObserver = new ResizeObserver(() => {
  postContentHeight(window.parent, document);
  // The observer's first callback runs at the browser's next rendering step, once the document
  // has been laid out, so this is the first moment a measurement is worth having. Announcing the
  // render here rather than earlier means a consumer that waits for documentRendered has always
  // received a real height by the time it arrives.
  postDocumentRendered(window.parent);
});

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

const handleDocumentRendered = () => {
  // Start reporting the height now rather than when the document arrives. Until the document
  // has rendered there is nothing to measure but the loading box, and in unwrapped mode the
  // stylesheet rules that make the content determine the height are not in effect yet, so an
  // earlier measurement would report the viewport's height instead of the document's.
  const content = document.getElementById("app");
  if (!content) {
    // Nothing to measure, but a consumer waiting on the message should not wait forever.
    postDocumentRendered(window.parent);
    return;
  }
  resizeObserver.observe(content);
};

let root: Root | undefined;

const renderEditor = () => {
  // createRoot is called once per container; subsequent updates use root.render().
  if (!root) {
    root = createRoot(document.getElementById("app")!);
  }
  root.render(
    <IframeDocumentEditor
      initialValue={initialValue}
      handleUpdateContent={handleUpdateContent}
      onDocumentRendered={handleDocumentRendered}
      fullHeight={fullHeight}
      noBorder={noBorder}
    />
  );
};
