import React from "react";
import { IDisposer, onSnapshot } from "mobx-state-tree";
import { Map } from "immutable";
import { appConfig, AppProvider, IAppProperties, initializeApp } from "../initialize-app";
import { IStores } from "../models/stores/stores";
import { createDocumentModel, DocumentModelType } from "../models/document/document";
import { defaultDocumentModelParts } from "../components/doc-editor-app-defaults";
import { EditableDocumentContent } from "../components/document/editable-document-content";

import "./clue-control.scss";

(window as any).DISABLE_FIREBASE_SYNC = true;

// There is a CmsWidgetControlProps type, but it doesn't seem to be
// exported by DecapCMS
interface IProps {
  field: any,
  onChange: (value: any) => void,
  forID: string,
  value: any,
  classNameWrapper: string,
  label?: string
}

interface IState {
  stores?: IStores;
  document?: DocumentModelType;
}

const initializeAppPromise = initializeApp("dev");

export class ClueControl extends React.Component<IProps, IState>  {
  disposer: IDisposer;
  // Notes on calls:
  // - After publishing a CMS page, the component on the page is not
  //   reconstructed. The existing component is reused. Because we are holding
  //   onto our own value (the document) this works
  // - When leaving (using the CMS ui) and coming back to the same page the
  //   component is reconstructed.
  // - When leaving (using the CMS ui) with unsaved changes, a message is shown,
  //   and the control is reconstructed when returning to the page.
  // - BUG: When leaving with unsaved changes by reloading the page in the
  //   browser:
  //   - a message is shown before reload confirming you want to lose your
  //     changes
  //   - a message is shown when the page is loaded again about an unsaved draft
  //     Choosing the draft doesn't show the unsaved changes. My guess is that
  //     the draft saving code might only work with string fields. This guess is
  //     based on the behavior of onChange. Immediately after the ClueControl
  //     calls onChange the ClueControl is re-rendered, but its value is JS
  //     object not an immutable object. Also looking at the CMS code there is
  //     one place where the value is typed with typescript to be a string The
  //     next place to look is at the CMS `Object` widget which must be saving a
  //     js object instead of a string.
  constructor(props: IProps) {
    super(props);
    console.log("ClueControl constructed", this.getValue());
    this.state = {};

    // Based on functional component code it might be possible the
    // value to start out falsy and then is set in a later render
    // I haven't yet seen that in practice, so this approach is more
    // simple for now.
    const initialValue = this.getValue();

    initializeAppPromise.then((appProperties: IAppProperties) => {

      // Wait to construct the document until the main CLUE stuff is
      // initialized. I'm not sure if this is necessary but it seems
      // like the safest way to do things
      const document = createDocumentModel({
        ...defaultDocumentModelParts,
        content: initialValue
      });
      this.setState({
        stores: appProperties.stores,
        document
      });

      // Update the widget's value whenever a change is made to the document's content
      this.disposer = onSnapshot(document, snapshot => {
        const json = document.content?.exportAsJson();
        if (json) {
          const parsedJson = JSON.parse(json);
          const stringifiedJson = JSON.stringify(parsedJson);
          // Only update when actual changes have been made.
          // This approach has a few problems:
          // - just loading the content and exporting it again often causes
          //   changes to the content. So just opening a page will result in
          //   the CMS saying there are "unsaved changes".
          // - if the component is re-used without being re-initialized
          //   this approach could be a problem, but I haven't seen that in practice.
          // - FIXME: if the user reverts the document to the initialValue that reversion
          //   won't be sent to the CMS.
          if (stringifiedJson !== JSON.stringify(initialValue)) {
            console.log("ClueControl onChange", parsedJson);
            // Looking at the CMS code it seems safer to pass an immutable object here
            // not a plain JS object. The plain JS object does get saved correctly,
            // but it also gets returned in the value so it means sometimes the value
            // is a immutable object and sometimes it is a plan JS object.
            const immutableValue = Map(parsedJson);
            this.props.onChange(immutableValue);
          }
        }
      });
    });
  }

  componentWillUnmount() {
    this.disposer?.();
  }

  render() {
    console.log("ClueControl rendered", this.getValue());

    if (this.state.stores && this.state.document) {
      return (
        <AppProvider stores={this.state.stores} modalAppElement="#nc-root">
          <EditableDocumentContent
            contained={true}
            mode="1-up"
            isPrimary={true}
            readOnly={false}
            document={this.state.document}
            toolbar={appConfig.toolbar}
          />
        </AppProvider>
      );
    } else {
      return <div className="loading-box">Loading editor...</div>;
    }
  }

  getValue() {
    return this.props.value?.toJS?.();
  }
}
