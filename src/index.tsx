import React from "react";
import ReactDOM from "react-dom";

import { AppProvider, IAppProperties, initializeApp } from "./initialize-app";
import { AppComponent } from "./components/app";

initializeApp().then(({ stores }: IAppProperties) => {
  if (stores) {
    ReactDOM.render(
      <AppProvider stores={stores}>
        <AppComponent />
      </AppProvider>,
      document.getElementById("app")
    );
  }
});
