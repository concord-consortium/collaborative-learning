import React from "react";
import ReactDOM from "react-dom";

import { EditorApp, IAppProperties, initializeApp } from "./initialize-app";

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
