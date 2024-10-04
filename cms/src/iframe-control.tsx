import React from "react";
import { Map } from "immutable";
import { CmsWidgetControlProps } from "decap-cms-core";

import { urlParams } from "./cms-url-params";
import { DEBUG_IFRAME } from "../../src/lib/debug";
import { defaultCurriculumBranch } from "./cms-constants";

import "./iframe-control.scss";

(window as any).DISABLE_FIREBASE_SYNC = true;

const iframeBase = urlParams.iframeBase ?? ".";
// the URL is relative to the current url of the CMS
// If the iframeBase is an absolute url then the current url will be ignored
const iframeBaseURL = new URL(iframeBase, window.location.href);
const validOrigin = iframeBaseURL.origin;

interface IState {
  initialValue?: string;
}
export class IframeControl extends React.Component<CmsWidgetControlProps, IState>  {
  constructor(props: CmsWidgetControlProps) {
    super(props);
    this.state = {
      initialValue: this.getValue(),
    };
  }

  componentDidMount = () => {
    if (DEBUG_IFRAME) {
      // eslint-disable-next-line no-console
      console.log("DEBUG: CMS ClueControl initial content value is: ", this.state.initialValue);
    }
  };

  handleUpdateContent = (content: string) => {
    const parsedJson = JSON.parse(content);
    const immutableValue = Map(parsedJson);
    this.props.onChange(immutableValue);
  };

  sendInitialValueToEditor() {
    const { initialValue } = this.state;
    const iframedEditor = document.getElementById("editor") as HTMLIFrameElement;
    if (iframedEditor.contentWindow) {
      iframedEditor.contentWindow.postMessage(
        { initialValue: JSON.stringify(initialValue) },
        validOrigin
      );
      (window as any).addEventListener("message", this.receiveUpdateFromEditor.bind(this));
    }
  }

  isValidMessageEvent = (event: MessageEvent) => {
    return event.data.type === "updateContent" &&
           event.data.content &&
           event.origin === validOrigin;
  };

  receiveUpdateFromEditor = (event: MessageEvent) => {
    if (this.isValidMessageEvent(event)) {
      this.handleUpdateContent(event.data.content);
    }
  };

  render() {
    const curriculumBranch = urlParams.curriculumBranch ?? defaultCurriculumBranch;
    const iframeBaseUrl = `${iframeBase}/iframe.html?curriculumBranch=${curriculumBranch}`;
    const iframeUrl = urlParams.unit
      ? `${iframeBaseUrl}&unit=${urlParams.unit}`
      : iframeBaseUrl;
    return (
      <div className="iframe-control custom-widget">
        <iframe id="editor" src={iframeUrl} allow="clipboard-read; clipboard-write; serial"
          onLoad={this.sendInitialValueToEditor.bind(this)}>
        </iframe>
      </div>
    );
  }

  getValue() {
    return this.props.value?.toJS?.();
  }
}
