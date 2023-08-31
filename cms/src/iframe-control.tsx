import React from "react";
import { Map } from "immutable";
import { CmsWidgetControlProps } from "netlify-cms-core";

import { urlParams } from "../../src/utilities/url-params";
import { DEBUG_CMS } from "../../src/lib/debug";
import { defaultCurriculumBranch } from "./cms-constants";

import "./iframe-control.scss";

(window as any).DISABLE_FIREBASE_SYNC = true;
interface IState {
  initialValue?: string;
  validOrigin: string;
}
export class IframeControl extends React.Component<CmsWidgetControlProps, IState>  {
  constructor(props: CmsWidgetControlProps) {
    super(props);
    this.state = {
      initialValue: this.getValue(),
      validOrigin: `${window.location.protocol}//${window.location.host}`
    };
  }

  componentDidMount = () => {
    if (DEBUG_CMS) {
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
    const { initialValue, validOrigin } = this.state;
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
    const { validOrigin } = this.state;
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
    const iframeBaseUrl = `./cms-editor.html?curriculumBranch=${curriculumBranch}`;
    const iframeUrl = urlParams.unit
      ? `${iframeBaseUrl}&unit=${urlParams.unit}`
      : iframeBaseUrl;
    return (
      <div className="iframe-control custom-widget">
        <iframe id="editor" src={iframeUrl} onLoad={this.sendInitialValueToEditor.bind(this)}></iframe>
      </div>
    );
  }

  getValue() {
    return this.props.value?.toJS?.();
  }
}
