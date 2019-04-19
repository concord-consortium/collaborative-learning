import { inject, observer } from "mobx-react";
import * as React from "react";
import { authenticate } from "../lib/auth";
import { GroupViewComponent } from "./group/group-view";
import { BaseComponent, IBaseProps } from "./base";
import { urlParams } from "../utilities/url-params";
import { DemoCreatorComponment } from "./demo/demo-creator";
import { TeacherDashboardComponent } from "./teacher/teacher-dashboard";
import * as AWS from "aws-sdk";
import { connect } from "mqtt";

import { GroupChooserComponent } from "./group/group-chooser";
import { IStores } from "../models/stores/stores";
import { updateProblem } from "../lib/misc";
import "./app.sass";

interface IProps extends IBaseProps {}
interface IState {
  qaCleared: boolean;
  qaClearError?: string;
  iotValues: {[deviceId: string]: number};
}

export const authAndConnect = (stores: IStores, onQAClear?: (result: boolean, err?: string) => void) => {
  const {appMode, user, db, ui} = stores;

  authenticate(appMode, urlParams)
    .then(({authenticatedUser, classInfo, problemId}) => {
      user.setAuthenticatedUser(authenticatedUser);
      if (classInfo) {
        stores.class.updateFromPortal(classInfo);
      }
      if (problemId) {
        updateProblem(stores, problemId);
      }

      if (typeof (window as any).Rollbar !== "undefined") {
        const _Rollbar = (window as any).Rollbar;
        if (_Rollbar.configure) {
          const config = { payload: {
                  class: authenticatedUser.classHash,
                  offering: authenticatedUser.offeringId,
                  person: { id: authenticatedUser.id },
                  problemId: problemId || "",
                  problem: stores.problem.title,
                  role: authenticatedUser.type,
                  unit: stores.unit.title,
                  version: stores.appVersion
                }};
          _Rollbar.configure(config);
        }
      }

      if (appMode === "authed")  {
        const { rawFirebaseJWT } = authenticatedUser;
        if (rawFirebaseJWT) {
          db.connect({appMode, stores, rawFirebaseJWT}).catch(ui.setError);
        }
        else {
          ui.setError("No firebase token available to connect to db!");
        }
      }
      else {
        db.connect({appMode, stores})
          .then(() => {
            if (appMode === "qa") {
              const {qaClear, qaGroup} = urlParams;
              if (qaClear) {
                const cleared = (err?: string) => {
                  if (onQAClear) {
                    onQAClear(!err, err);
                  }
                };
                db.clear(qaClear)
                  .then(() => cleared())
                  .catch(cleared);
              }
              else if (qaGroup) {
                db.leaveGroup().then(() => db.joinGroup(qaGroup));
              }
            }
          })
          .catch(ui.setError);
      }
    })
    .catch((error) => {
      let errorMessage = error.toString();
      if ((errorMessage.indexOf("Cannot find AccessGrant") !== -1) ||
          (errorMessage.indexOf("AccessGrant has expired") !== -1)) {
        errorMessage = "Your authorization has expired.  Please close this window and re-run the activity.";
      }
      ui.setError(errorMessage);
    });
};

const getUtils = () => {
  return (AWS as any).util;
};

const getSignatureKey = (key: string, date: any, region: any, service: any) => {
    const kDate = getUtils().crypto.hmac("AWS4" + key, date, "buffer");
    const kRegion = getUtils().crypto.hmac(kDate, region, "buffer");
    const kService = getUtils().crypto.hmac(kRegion, service, "buffer");
    const kCredentials = getUtils().crypto.hmac(kService, "aws4_request", "buffer");
    return kCredentials;
};

const getSignedUrl = (
  host: string,
  region: string,
  credentials: { accessKeyId: string; secretAccessKey: any; sessionToken?: string; }) => {
    const datetime = getUtils().date.iso8601(new Date()).replace(/[:\-]|\.\d{3}/g, "");
    const date = datetime.substr(0, 8);

    const method = "GET";
    const protocol = "wss";
    const uri = "/mqtt";
    const service = "iotdevicegateway";
    const algorithm = "AWS4-HMAC-SHA256";

    const credentialScope = date + "/" + region + "/" + service + "/" + "aws4_request";
    let canonicalQuerystring = "X-Amz-Algorithm=" + algorithm;
    canonicalQuerystring += "&X-Amz-Credential=" + encodeURIComponent(credentials.accessKeyId + "/" + credentialScope);
    canonicalQuerystring += "&X-Amz-Date=" + datetime;
    canonicalQuerystring += "&X-Amz-SignedHeaders=host";

    const canonicalHeaders = "host:" + host + "\n";
    const payloadHash = getUtils().crypto.sha256("", "hex");
    const canonicalRequest = method + "\n" + uri + "\n" + canonicalQuerystring +
      "\n" + canonicalHeaders + "\nhost\n" + payloadHash;

    const stringToSign = algorithm + "\n" + datetime + "\n" + credentialScope +
      "\n" + getUtils().crypto.sha256(canonicalRequest, "hex");
    const signingKey = getSignatureKey(credentials.secretAccessKey, date, region, service);
    const signature = getUtils().crypto.hmac(signingKey, stringToSign, "hex");

    canonicalQuerystring += "&X-Amz-Signature=" + signature;
    if (credentials.sessionToken) {
        canonicalQuerystring += "&X-Amz-Security-Token=" + encodeURIComponent(credentials.sessionToken);
    }

    const requestUrl = protocol + "://" + host + uri + "?" + canonicalQuerystring;
    return requestUrl;
};

@inject("stores")
@observer
export class AppComponent extends BaseComponent<IProps, IState> {

  public state: IState = {
    qaCleared: false,
    qaClearError: undefined,
    iotValues: {}
  };

  public componentWillMount() {
    authAndConnect(this.stores, (qaCleared, qaClearError) => {
      this.setState({qaCleared, qaClearError});
    });

    const AWS_IOT_ENDPOINT_HOST = "a2zxjwmcl3eyqd-ats.iot.us-east-1.amazonaws.com";
    const MQTT_TOPIC = "test_topic";

    AWS.config.region = "us-east-1";
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
      IdentityPoolId: "us-east-1:153d6337-3421-4c34-a21f-d1d2143a5091"
    });
    (AWS.config.credentials as AWS.Credentials).get((err) => {
      if (!err && AWS.config.credentials) {
        const { accessKeyId, secretAccessKey, sessionToken } = AWS.config.credentials;

        // List things
        const iot = new AWS.Iot({
          region: "us-east-1",
          accessKeyId,
          secretAccessKey,
          sessionToken
        });
        const thingState = {...this.state.iotValues};
        iot.listThings().promise().then(data => {
          if (data && data.things) {
            data.things.forEach(thing => {
              if (thing.thingName) {
                thingState[thing.thingName] = 0;
              }
            });
          }
          this.setState({
            iotValues: thingState
          });
        });

        // Subscribe
        const url = getSignedUrl(AWS_IOT_ENDPOINT_HOST, "us-east-1", {
          accessKeyId,
          secretAccessKey,
          sessionToken
        });
        const client = connect(url);
        client.subscribe(MQTT_TOPIC);
        client.on("message", (topic, rawMessage) => {
          const message = JSON.parse(rawMessage as any);
          if (message.client && message.value) {
            const newState = {...this.state.iotValues};
            newState[message.client] = message.value;
            this.setState({iotValues: newState});
          }
        });
      }
    });

  }

  public componentWillUnmount() {
    this.stores.db.disconnect();
  }

  public render() {
    // const {user, ui, db, groups} = this.stores;

    // if (ui.showDemoCreator) {
    //   return this.renderApp(<DemoCreatorComponment />);
    // }

    // if (ui.error) {
    //   return this.renderApp(this.renderError(ui.error));
    // }

    // if (!user.authenticated || !db.listeners.isListening) {
    //   return this.renderApp(this.renderLoading());
    // }

    // if (urlParams.qaClear) {
    //   const {qaCleared, qaClearError} = this.state;
    //   return this.renderApp(
    //     <span className="qa-clear">
    //       {qaCleared ? `QA Cleared: ${qaClearError || "OK"}` : "QA Clearing..."}
    //     </span>
    //   );
    // }

    // if (!groups.groupForUser(user.id)) {
    //   if (user.type === "teacher") {
    //     return this.renderApp(<TeacherDashboardComponent />);
    //   }
    //   else {
    //     return this.renderApp(<GroupChooserComponent />);
    //   }
    // }

    return this.renderApp(<GroupChooserComponent iotValues={this.state.iotValues}/>);
  }

  private renderApp(children: JSX.Element | JSX.Element[]) {
    return (
      <div className="app">
        {children}
      </div>
    );
  }

  private renderLoading() {
    return (
      <div className="progress">
        Loading CLUE ...
      </div>
    );
  }

  private renderError(error: string) {
    return (
      <div className="error">
        {error.toString()}
      </div>
    );
  }
}
