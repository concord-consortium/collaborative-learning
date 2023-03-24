import React from "react";
import ReactDOM from "react-dom";

import { EditorApp, IAppProperties, initializeApp } from "./initialize-app";

(window as any).DISABLE_FIREBASE_SYNC = true;

initializeApp().then(({ queryClient, stores }: IAppProperties) => {
  if (stores && queryClient) {
    const docEditorAppProps = {};
    ReactDOM.render(
      <EditorApp
        docEditorAppProps={docEditorAppProps}
        queryClient={queryClient}
        stores={stores}
      />,
      document.getElementById("app")
    );
  }
});
