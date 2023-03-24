import "ts-polyfill";

import React from "react";
import { Provider } from "mobx-react";
// import ReactDOM from "react-dom";
import { QueryClient, QueryClientProvider } from "react-query";
import { setLivelinessChecking } from "mobx-state-tree";
import { ModalProvider } from "@concord-consortium/react-modal-hook";

import { appConfigSnapshot, appIcons, createStores } from "../app-config";
import { AppConfigContext } from "../app-config-context";
import { AppConfigModel } from "../models/stores/app-config-model";
import { IStores, setUnitAndProblem } from "../models/stores/stores";
import { UserModel } from "../models/stores/user";
import { urlParams } from "../utilities/url-params";
import { getAppMode } from "../lib/auth";
import { DEBUG_STORES } from "../lib/debug";
import { Logger } from "../lib/logger";
import { setPageTitle } from "../lib/misc";
import { gImageMap } from "../models/image-map";
import PackageJson from "../../package.json";
import { DocEditorApp } from "../components/doc-editor-app";

import "./clue-control.scss";
import "../index.scss";

// set to true to enable MST liveliness checking
const kEnableLivelinessChecking = false;

(window as any).DISABLE_FIREBASE_SYNC = true;

const appConfig = AppConfigModel.create(appConfigSnapshot);

interface IAppProperties {
  queryClient: QueryClient;
  stores: IStores;
}
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

  const queryClient = new QueryClient();

  return { queryClient, stores };
};

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
  queryClient?: QueryClient;
  stores?: IStores;
  // valueString: string;
}

export class ClueControl extends React.Component<IProps, IState>  {
  static defaultProps = {
    value: '',
  };

  constructor(props: IProps) {
    super(props);
    // const valueString = props.value?.toJS ? JSON.stringify(props.value.toJS(), null, 2) : "";
    // this.state = {valueString};
    this.state = {};

    initializeApp().then((appProperties: IAppProperties) => {
      this.setState(appProperties);
    });
  }

  handleChange(e: any) {
    // this.setState({valueString: e.target.value});
    try {
      const json = JSON.parse(e.target.value);
      this.props.onChange(json);
    } catch (error) {
      // console.log(`illegal json`, e.target.value);
    }
  }

  render() {
    if (this.state.stores && this.state.queryClient) {
      // `label` is not documented in the Decap docs and it is also not
      // listed in the CmsWidgetControlProps provided by Decap
      // but it does seem to provide the label of the field
      // const { label } = this.props;

      // return (
      //   <div className="json-control">
      //     <label htmlFor="jsonControl">{label}</label>
      //     <textarea
      //       id="jsonControl"
      //       value={this.state.valueString}
      //       onChange={this.handleChange.bind(this)}
      //     />
      //   </div>
      // );
      return (
        <AppConfigContext.Provider value={{ appIcons }} >
          <Provider stores={this.state.stores}>
            <ModalProvider>
              <QueryClientProvider client={this.state.queryClient}>
                <DocEditorApp
                  appConfig={appConfig}
                  contained={true}
                  editorMode="cmsWidget"
                  initialValue={this.props.value.toJS?.()}
                  onChange={this.props.onChange}
                />
              </QueryClientProvider>
            </ModalProvider>
          </Provider>
        </AppConfigContext.Provider>
      );
    }

    return <div className="loading-box">Loading editor...</div>;
  }
}

