import React from "react";
import ReactDOM from "react-dom";
import { DocEditorApp } from "./components/doc-editor-app";
import { gAppConfig } from "./global-app-config";
import { AppProvider, initializeApp } from "./initialize-app";

(window as any).DISABLE_FIREBASE_SYNC = true;

initializeApp("dev", true).then((stores) => {
  ReactDOM.render(
    <AppProvider stores={stores} modalAppElement="#app">
      <DocEditorApp appConfig={gAppConfig}/>
    </AppProvider>,
    document.getElementById("app")
  );
});
