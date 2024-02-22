import React from "react";
import { IDisposer, onSnapshot } from "mobx-state-tree";
import { Map } from "immutable";

import { defaultDocumentModelParts } from "../components/doc-editor-app-defaults";
import { AppProvider, initializeApp } from "../initialize-app";
import { createDocumentModelWithEnv, DocumentModelType } from "../models/document/document";
import { DEBUG_CMS } from "../lib/debug";
import { EditableDocumentContent } from "../components/document/editable-document-content";

import "../../cms/src/custom-control.scss";

(window as any).DISABLE_FIREBASE_SYNC = true;

interface IProps {
  initialValue?: DocumentModelType;
  handleUpdateContent: (json: Record<string, any>) => void;
}

interface IState {
  document?: DocumentModelType;
}

const stores = initializeApp("dev", true);

export class DocumentEditor extends React.Component<IProps, IState>  {
  disposer: IDisposer;
  constructor(props: any) {
    super(props);
    this.state = {};

    // Need wait for the unit to be loaded to safely render the components
    stores.unitLoadedPromise.then(() => {
      const { initialValue } = this.props;
      const { appConfig } = stores;
      // Wait to construct the document until the main CLUE stuff is
      // initialized. I'm not sure if this is necessary but it seems
      // like the safest way to do things
      const document = createDocumentModelWithEnv(appConfig, {
        ...defaultDocumentModelParts,
        content: initialValue
      });

      // Save the initial state, this is compared with the exported state
      // on each snapshot. See the comment below for more details
      let lastState = JSON.stringify(initialValue);

      // Update the widget's value whenever a change is made to the document's content
      this.disposer = onSnapshot(document, snapshot => {
        // FIXME: If the document has tiles at the end of it which aren't setup by the unit json,
        // then exportAsJson creates an invalid JSON file. It leaves a trailing comma after the
        // last known tile.
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
            // is a immutable object and sometimes it is a plain JS object.
            const immutableValue = Map(parsedJson);
            this.props.handleUpdateContent(immutableValue);
            if (DEBUG_CMS) {
              // eslint-disable-next-line no-console
              console.log("DEBUG: CMS ClueControl onChange called with new content value: ", parsedJson);
            }
          }
        }
      });

      this.setState({
        document
      });
    });
  }

  componentWillUnmount() {
    this.disposer?.();
  }

  render() {
    const { document } = this.state;
    if (document) {
      return (
        <AppProvider stores={stores} modalAppElement="#app">
          <EditableDocumentContent
            className="iframe-control"
            contained={true}
            mode="1-up"
            isPrimary={true}
            readOnly={false}
            document={document}
            toolbar={stores.appConfig.authorToolbar}
          />
        </AppProvider>
      );
    } else {
      return (
        <div className="loading-box">Loading editor...</div>
      );
    }
  }
}
