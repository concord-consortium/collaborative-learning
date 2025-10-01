
import React, { useEffect, useCallback } from "react";

import { DEBUG_IFRAME } from "../../../lib/debug";

import "./iframe-control.scss";

(window as any).DISABLE_FIREBASE_SYNC = true;

const urlParams = new URLSearchParams(window.location.search);
const iframeBase = urlParams.get("iframeBase") ?? ".";
const iframeBaseURL = new URL(iframeBase, window.location.href);
const validOrigin = iframeBaseURL.origin;

interface IProps {
  initialValue: string;
  onChange?: (value: string) => void;
}

export const IframeControl: React.FC<IProps> = (props) => {
  const { initialValue, onChange} = props;

  useEffect(() => {
    if (DEBUG_IFRAME) {
      // eslint-disable-next-line no-console
      console.log("DEBUG: initial content value is: ", initialValue);
    }
  }, [initialValue]);

  const handleUpdateContent = useCallback((content: string) => onChange?.(content), [onChange]);

  const isValidMessageEvent = (event: MessageEvent) => {
    return event.data.type === "updateContent" &&
           event.data.content &&
           event.origin === validOrigin;
  };

  const receiveUpdateFromEditor = useCallback((event: MessageEvent) => {
    if (isValidMessageEvent(event)) {
      handleUpdateContent(event.data.content);
    }
  }, [handleUpdateContent]);

  const sendInitialValueToEditor = useCallback(() => {
    const iframedEditor = document.getElementById("editor") as HTMLIFrameElement;
    if (iframedEditor?.contentWindow) {
      iframedEditor.contentWindow.postMessage(
        { initialValue: JSON.stringify(initialValue) },
        validOrigin
      );
      (window as any).addEventListener("message", receiveUpdateFromEditor);
    }
  }, [initialValue, receiveUpdateFromEditor]);

  useEffect(() => {
    // Cleanup event listener on unmount
    return () => {
      (window as any).removeEventListener("message", receiveUpdateFromEditor);
    };
  }, [receiveUpdateFromEditor]);

  const curriculumBranch = urlParams.get("curriculumBranch") ?? "author";
  const iframeBaseUrl = `${iframeBase}/iframe.html?fullHeight=true&noBorder=true&curriculumBranch=${curriculumBranch}`;
  const iframeUrl = urlParams.get("unit")
    ? `${iframeBaseUrl}&unit=${urlParams.get("unit")}`
    : iframeBaseUrl;

  return (
    <div className="iframe-control custom-widget">
      <iframe
        id="editor"
        src={iframeUrl}
        allow="clipboard-read; clipboard-write; serial"
        onLoad={sendInitialValueToEditor}
      />
    </div>
  );
};
