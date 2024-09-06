import React from "react";
import ReactDOM from "react-dom";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";
import { DocEditorApp } from "./components/doc-editor/doc-editor-app";
import { DialogComponent } from "./components/utilities/dialog";

import { AppProvider, initializeApp } from "./initialize-app";

(window as any).DISABLE_FIREBASE_SYNC = true;

const stores = initializeApp(true);

// By default Chakra adds some global styles which break some of the
// CLUE styles. But removing these styles then breaks the Chakra
// components. The workaround here is to add the necessary styles
// to the specific components we are using. As far as I can tell
// there isn't a way with Chakra to apply the styles to just the
// Chakra components with one statement.
// If you need additional global styles this page shows them:
// https://v1.chakra-ui.com/docs/styled-system/features/global-styles
const theme = extendTheme({
  components: {
    Checkbox: {
      baseStyle: (props: any) => ({
        control: {
          borderColor: mode('gray.200', 'whiteAlpha.300')(props)
        }
      })
    }
  }
});
// This is how we disable all of the global styles
theme.styles.global = undefined;

// Need wait for the unit to be loaded to safely render the components
stores.unitLoadedPromise.then(() => {
  ReactDOM.render(
    <ChakraProvider theme={theme} resetCSS={false}>
      <AppProvider stores={stores} modalAppElement="#app">
        <DocEditorApp/>
        <DialogComponent/>
      </AppProvider>,
    </ChakraProvider>,
    document.getElementById("app")
  );
});
