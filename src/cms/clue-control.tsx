import React from "react";
import { IDisposer, onSnapshot } from "mobx-state-tree";
import { Map } from "immutable";
import { CmsWidgetControlProps } from "netlify-cms-core";

import { defaultDocumentModelParts } from "../components/doc-editor-app-defaults";
import { EditableDocumentContent } from "../components/document/editable-document-content";
import { appConfig, AppProvider, initializeApp } from "../initialize-app";
import { IStores } from "../models/stores/stores";
import { createDocumentModel, DocumentModelType } from "../models/document/document";

import "./clue-control.scss";
import "./custom-control.scss";

(window as any).DISABLE_FIREBASE_SYNC = true;

interface IState {
  document?: DocumentModelType;
  stores?: IStores;
}

// Initialize the app just one time globally, each control waits for this
// initialization to finish to know the `stores` so the document editor
// can use these stores
const initializeAppPromise = initializeApp("dev", true);

// We are using the CmsWidgetControlProps for the type of properties passed to
// the control. This doesn't actually include all of the properties that are
// available. A more complete list can be found in Widget.js in the DecapCMS
// source code.
export class ClueControl extends React.Component<CmsWidgetControlProps, IState>  {
  disposer: IDisposer;
  // Because we only create the document from the value property in the
  // constructor, it is important to make sure the component is reconstructed
  // whenever the CMS changes the value. As far as I can tell that is always
  // the case.
  //
  // Notes on calls:
  // - After publishing a CMS page, the component on the page is not
  //   reconstructed. The existing component is reused. Because we are holding
  //   onto the document this works fine.
  // - When leaving (using the CMS ui) and coming back to the same page the
  //   component is reconstructed.
  // - When leaving (using the CMS ui) with unsaved changes, a message is shown,
  //   and the control is reconstructed when returning to the page.
  // - When leaving with unsaved changes by reloading the page in the
  //   browser:
  //   - a message is shown before reload confirming you want to lose your
  //     changes
  //   - a message is shown when the page is loaded again about an unsaved draft
  //     Choosing the draft doesn't always work. See the "Known Issues" section of
  //     cms.md
  constructor(props: CmsWidgetControlProps) {
    super(props);
    this.state = {};

    const initialValue = this.getValue();

    initializeAppPromise.then((stores) => {

      // Wait to construct the document until the main CLUE stuff is
      // initialized. I'm not sure if this is necessary but it seems
      // like the safest way to do things
      const document = createDocumentModel({
        ...defaultDocumentModelParts,
        content: initialValue
      });

      // Save the initial state, this is compared with the exported state
      // on each snapshot. See the comment below for more details
      let lastState = JSON.stringify(initialValue);

      // Update the widget's value whenever a change is made to the document's content
      this.disposer = onSnapshot(document, snapshot => {
        const json = document.content?.exportAsJson({ includeTileIds: true });
        if (json) {
          const parsedJson = JSON.parse(json);
          const stringifiedJson = JSON.stringify(parsedJson);
          // Only update when actual changes have been made.
          // CLUE sometimes changes the document state but those changes are not
          // part of the exported JSON. One example is when the row height is adjusted
          // this is saved into the document but not exported and the value of this
          // row height could change based on the window width.
          // So we start with the initial JSON and then only call the CMS onChange
          // when the exported value changes from the last exported value.
          //
          // Note: when loading manually authored content there will often be an
          // immediate change which is not visible. An example of that is when an author
          // has divided the text of a text tile into multiple strings. This is exported
          // as a single string.
          if (stringifiedJson !== lastState) {
            lastState = stringifiedJson;
            // Looking at the CMS code it seems safer to pass an immutable object here
            // not a plain JS object. The plain JS object does get saved correctly,
            // but it also gets returned in the value property so it means sometimes the value
            // is a immutable object and sometimes it is a plan JS object.
            const immutableValue = Map(parsedJson);
            this.props.onChange(immutableValue);
          }
        }
      });

      this.setState({
        document,
        stores
      });
    });
  }

  componentWillUnmount() {
    this.disposer?.();
  }

  render() {
    if (this.state.stores && this.state.document) {
      return (
        <AppProvider stores={this.state.stores} modalAppElement="#nc-root">
          <EditableDocumentContent
            contained={true}
            mode="1-up"
            isPrimary={true}
            readOnly={false}
            document={this.state.document}
            toolbar={appConfig.authorToolbar}
          />
        </AppProvider>
      );
    } else {
      return (
        <div className="custom-widget loading-box">Loading editor...</div>
      );
    }
  }

  getValue() {
    return this.props.value?.toJS?.();
  }
}
