import "ts-polyfill";

import { Provider } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { appConfigSnapshot, appIcons, createStores } from "./app-config";
import { AppConfigContext } from "./app-config-context";
import { AppComponent } from "./components/app";
import { AppConfigModel } from "./models/stores/app-config-model";
import { setUnitAndProblem } from "./models/stores/stores";
import { UserModel } from "./models/stores/user";
import { urlParams } from "./utilities/url-params";
import { getAppMode } from "./lib/auth";
import { DEBUG_STORES } from "./lib/debug";
import { Logger } from "./lib/logger";
import { setPageTitle } from "./lib/misc";
import { gImageMap } from "./models/image-map";
import PackageJson from "../package.json";
import { setLivelinessChecking } from "mobx-state-tree";
// set to true to enable MST liveliness checking
const kEnableLivelinessChecking = false;

(window as any).DISABLE_FIREBASE_SYNC = true;

import "./index.scss";
import { EditableDocumentContent } from "./components/document/editable-document-content";
import { createDocumentModel, DocumentModel } from "./models/document/document";
import { ProblemDocument } from "./models/document/document-types";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { QueryClient, QueryClientProvider } from "react-query";

const appConfig = AppConfigModel.create(appConfigSnapshot);

const initializeApp = async () => {
  const host = window.location.host.split(":")[0];
  const appMode = getAppMode(urlParams.appMode, urlParams.token, host);
  const appVersion = PackageJson.version;

  const user = UserModel.create();

  const unitId = urlParams.unit || appConfigSnapshot.defaultUnit;
  const problemOrdinal = urlParams.problem || appConfigSnapshot.config.defaultProblemOrdinal;
  const showDemoCreator = urlParams.demo;
  const demoName = urlParams.demoName;

  const isPreviewing = !!(urlParams.domain && urlParams.domain_uid && !urlParams.token);
  const stores = createStores({ appMode, appVersion, appConfig, user, showDemoCreator, demoName, isPreviewing });

  if (DEBUG_STORES) {
    (window as any).stores = stores;
  }

  // TODO: It'd be better to have another way to do this since we are just editing a document.
  // However we do want to support configuring which tools to use based on a unit and problem.
  // So for the time being this approach lets us do that via url parameters.
  await setUnitAndProblem(stores, unitId, problemOrdinal);

  gImageMap.initialize(stores.db);

  Logger.initializeLogger(stores, { investigation: stores.investigation.title, problem: stores.problem.title });

  if (kEnableLivelinessChecking) {
    setLivelinessChecking("error");
  }

  setPageTitle(stores);
  stores.ui.setShowDemoCreator(!!showDemoCreator);
  stores.supports.createFromUnit({
    unit: stores.unit,
    investigation: stores.investigation,
    problem: stores.problem,
    documents: stores.documents,
    db: stores.db
  });

  // TODO: here is where we can try to render the
  // EditableDocumentContent instead of App
  // We need:
  // mode: WorkspaceMode;
  // isPrimary: boolean;
  // document: DocumentModelType;
  // showPlayback?: boolean;
  // toolbar?: IToolbarModel;
  // readOnly?: boolean;
  //
  // - `document` can be created from the input (url or local file)
  // - `isPrimary`, and `showPlayback` can probably be set the same
  // true or false values all of the time
  // - `readOnly` could be set based on a URL parameter so we can test out
  // a preview vs editable view
  // - `toolbar` we have to figure out it seems like we'd want to create this model
  // - `mode` we have to figure out, but probably it can be set to the same
  // value all of the time
  //
  // We'll start with ust seeing if this works with the separate entry point
  // without changes.
  const rowId = "row1";
  const tileId = "tile1";
  const fakeDocument = createDocumentModel({
    type: ProblemDocument,
    title: "test",
    uid: "1",
    key: "test",
    createdAt: 1,
    visibility: "public",
    content: {
      rowMap: {
        [rowId]: {
          id: rowId,
          tiles: [{ tileId }]
        }
      },
      rowOrder: [
        rowId
      ],
      tileMap: {
        [tileId]: {
          id: tileId,
          content: {
            type: "Text",
            text: "test"
          }
        }
      }
    }
  });

  const queryClient = new QueryClient();

  // Note: by making the document readOnly disables `useSyncMstPropToFirebase`
  ReactDOM.render(
    <AppConfigContext.Provider value={{ appIcons }} >
      <Provider stores={stores}>
        <ModalProvider>
          <QueryClientProvider client={queryClient}>
            <EditableDocumentContent
              mode="1-up"
              isPrimary={true}
              readOnly={false}
              document={fakeDocument}
              toolbar={appConfig.toolbar}
            />
          </QueryClientProvider>
        </ModalProvider>
      </Provider>
    </AppConfigContext.Provider>,
    document.getElementById("app")
  );
};

initializeApp();
