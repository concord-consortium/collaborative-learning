
import React, { useEffect, useCallback } from "react";

import { DEBUG_IFRAME } from "../../../lib/debug";
import { useCurriculum } from "../../hooks/use-curriculum";
import { useAuth } from "../../hooks/use-auth";
import RawSettingsControl from "./raw-settings-control";

import "./iframe-control.scss";

(window as any).DISABLE_FIREBASE_SYNC = true;

const urlParams = new URLSearchParams(window.location.search);
// note: .. is used below as we are not in the root but rather in authoring/
const iframeBase = urlParams.get("iframeBase") ?? "..";
const iframeBaseURL = new URL(iframeBase, window.location.href);
const validOrigin = iframeBaseURL.origin;

interface IProps {
  initialValue: string;
  rawContent: string;
  onChange?: (value: string) => void;
  onRawChange?: (value: string) => void;
  headerContent?: React.ReactNode;
}

export const IframeControl: React.FC<IProps> = (props) => {
  const { isAdminUser } = useAuth();
  const { branch, unit } = useCurriculum();
  const { initialValue, rawContent, onChange, onRawChange, headerContent} = props;
  const [ currentTab, setCurrentTab ] = React.useState<"editor" | "rawJson">("editor");

  useEffect(() => {
    if (DEBUG_IFRAME) {
      // eslint-disable-next-line no-console
      console.log("DEBUG: initial content value is: ", initialValue);
    }
  }, [initialValue]);

  const handleUpdateContent = useCallback((content: string) => onChange?.(content), [onChange]);
  const handleUpdateRawContent = useCallback((content: string) => onRawChange?.(content), [onRawChange]);

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
    }
  }, [initialValue]);

  useEffect(() => {
    // Listen for messages from the iframe editor
    (window as any).addEventListener("message", receiveUpdateFromEditor);

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

  const iframeUrl = new URL(`${iframeBaseURL.toString()}authoring-iframe/index.html`);
  iframeUrl.search = iframeParams.toString();

  const handleReload = () => {
    window.location.reload();
  };

  const handleSaveRawJson = (newJson: any) => {
    handleUpdateRawContent(JSON.stringify(newJson, null, 2));
  };

  const renderIframe = () => {
    return (
      <iframe
        id="editor"
        src={iframeUrl.toString()}
        allow="clipboard-read; clipboard-write; serial"
        onLoad={sendInitialValueToEditor}
      />
    );
  };

  if (isAdminUser) {
    return (
      <div className="iframe-control tabbed">
        <div className="iframe-control-tabs">
          <div
            className={`${currentTab === "editor" ? "active" : ""}`}
            onClick={() => setCurrentTab("editor")}>
            Editor
          </div>
          <div
            className={`${currentTab === "rawJson" ? "active" : ""}`}
            onClick={() => setCurrentTab("rawJson")}>
            Raw JSON (Admin Only)
          </div>
        </div>
        <div className="iframe-control-tab-content">
          <div className={`iframe-control-tab-pane ${currentTab === "editor" ? "active" : ""}`}>
            <div className="top-buttons">
              <button onClick={handleReload}>Reload</button>
              <div>(reload needed if you update and save the raw json)</div>
            </div>
            {headerContent}
            {renderIframe()}
          </div>
          <div className={`iframe-control-tab-pane ${currentTab === "rawJson" ? "active" : ""}`}>
            <RawSettingsControl initialValue={rawContent} onSave={handleSaveRawJson} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="iframe-control">
      {renderIframe()}
    </div>
  );
};
