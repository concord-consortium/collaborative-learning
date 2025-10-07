
import React, { useEffect, useCallback } from "react";

import { DEBUG_IFRAME } from "../../../lib/debug";
import { useCurriculum } from "../../hooks/use-curriculum";

import "./iframe-control.scss";

(window as any).DISABLE_FIREBASE_SYNC = true;

const urlParams = new URLSearchParams(window.location.search);
// note: .. is used below as iframe.html is in root and authoring is in authoring/
const iframeBase = urlParams.get("iframeBase") ?? "..";
const iframeBaseURL = new URL(iframeBase, window.location.href);
const validOrigin = iframeBaseURL.origin;

interface IProps {
  initialValue: string;
  onChange?: (value: string) => void;
}

export const IframeControl: React.FC<IProps> = (props) => {
  const { branch, unit } = useCurriculum();
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


  // use the same params to enable overrides of the emulator, functions, etc
  const iframeParams = new URLSearchParams(window.location.search);
  iframeParams.set("fullHeight", "true");
  iframeParams.set("noBorder", "true");
  if (branch && unit) {
    iframeParams.set("authoringBranch", branch);
    iframeParams.set("unit", unit);
  }
  iframeParams.delete("fakeAuthoringAuth");

  const iframeUrl = new URL(`${iframeBaseURL.toString()}iframe.html`);
  iframeUrl.search = iframeParams.toString();

  return (
    <div className="iframe-control custom-widget">
      <iframe
        id="editor"
        src={iframeUrl.toString()}
        allow="clipboard-read; clipboard-write; serial"
        onLoad={sendInitialValueToEditor}
      />
    </div>
  );
};
