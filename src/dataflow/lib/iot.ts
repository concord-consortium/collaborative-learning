import { MqttClient, connect } from "mqtt";
import { IStores } from "../models/stores/dataflow-stores";
import { getSignedUrl } from "../utilities/aws";
import { HubChannel } from "../models/stores/hub-store";
import * as AWS from "aws-sdk";

const AWS_REGION = "us-east-1";
const COGNITO_POOL = "us-east-1:153d6337-3421-4c34-a21f-d1d2143a5091";
const AWS_IOT_ENDPOINT_HOST = "a2zxjwmcl3eyqd-ats.iot.us-east-1.amazonaws.com";
// WTD This is for testing purposes only. Remove when we add users and hub owners.
const OWNER_ID = "123";
// WTD This is for testing purposes only. Sensor send interval should be set by user.
const SEND_INTERVAL = 2;

export class IoT {
  public stores: IStores;
  public client: MqttClient;
  public iotCore: AWS.Iot;

  private thingListener: NodeJS.Timeout;

  public connect(stores: IStores) {
    this.stores = stores;

    if (this.client && this.client.connected) {
      return;
    }

    AWS.config.region = "us-east-1";
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
      IdentityPoolId: COGNITO_POOL
    });

    (AWS.config.credentials as AWS.Credentials).get((err) => {
      if (!err && AWS.config.credentials) {
        this.startThingListener(AWS.config.credentials as AWS.Credentials);
        this.startMqttClient(AWS.config.credentials as AWS.Credentials);
      }
    });
  }

  public disconnect() {
    if (this.client) {
      this.client.end();
    }

    if (this.thingListener) {
      clearInterval(this.thingListener);
    }
  }

  private startThingListener(credentials: AWS.Credentials) {
    const { accessKeyId, secretAccessKey, sessionToken } = credentials;

    this.iotCore = new AWS.Iot({
      region: AWS_REGION,
      accessKeyId,
      secretAccessKey,
      sessionToken
    });
    this.updateHubs();
    this.thingListener = setInterval(this.updateHubs, 5000);
  }

  private updateHubs = () => {
    const  { hubStore } = this.stores;
    this.iotCore.listThings().promise().then(data => {
      if (data && data.things) {
        data.things.forEach(thing => {
          const { thingName, thingArn, thingTypeName } = thing;
          if (thingName && thingArn && !hubStore.getThing(thingArn)) {
            hubStore.addHub({
              hubName: thingName,
              hubArn: thingArn,
              hubTypeName: thingTypeName ? thingTypeName : undefined,
              // use attribute name when available (some things may not include it)
              hubDisplayedName: thing.attributes && thing.attributes.name ?
                                  thing.attributes.name :
                                  thingName,
              hubChannels: []
            });
            // subscribe to any necessary topics for the new thing
            this.client.subscribe(this.constructDevicesTopic(OWNER_ID, thingName));
            this.client.subscribe(this.constructSensorsTopic(OWNER_ID, thingName));
            this.requestDeviceInfo(thingName);
          }
        });
      }
    });
  }

  private constructDevicesTopic(ownerID: string, hubName: string) {
    return (ownerID + "/hub/" + hubName + "/devices");
  }
  private constructSensorsTopic(ownerID: string, hubName: string) {
    return (ownerID + "/hub/" + hubName + "/sensors");
  }
  private constructStatusTopic(ownerID: string, hubName: string) {
    return (ownerID + "/hub/" + hubName + "/status");
  }
  private constructCommandTopic(ownerID: string, hubName: string) {
    // use to tell a hub to send status, sensors, or devices topic messages
    return (ownerID + "/hub/" + hubName + "/command");
  }
  private constructActuatorsTopic(ownerID: string, hubName: string) {
    return (ownerID + "/hub/" + hubName + "/actuators");
  }

  private requestSensorInfo(hubName: string) {
    const topicMessage = JSON.stringify({ command: "set_send_interval", send_interval: SEND_INTERVAL});
    this.client.publish(this.constructCommandTopic(OWNER_ID, hubName), topicMessage);

  }
  private requestDeviceInfo(hubName: string) {
    const topicMessage = JSON.stringify({ command: "req_devices"});
    this.client.publish(this.constructCommandTopic(OWNER_ID, hubName), topicMessage);
  }

  private processDevicesMessage(hubName: string, message: any) {
    const  { hubStore } = this.stores;
    const hub = hubStore.getHubByName(hubName);
    if (hub !== undefined) {
      hub.setOnlineStatus(true);
      const devices = Object.values(message);
      const deviceKeys = Object.keys(message);
      hub.removeAllHubChannels();
      // hub may have 1 or more devices
      devices.forEach((device: any, index: number) => {
        // device may have 1 or more components (called "channels" in Dataflow)
        device.components.forEach((component: any) => {
          // add channels to hub (may be sensor or relay)
          const model = component.model ? component.model : "N/A";
          const units = component.units ? component.units : "N/A";
          // in some cases the component id is not in the message explicitly
          // and needs to be constructed.
          // component id has form "deviceid-componenttypeprefix" where
          // componenttypeprefix is first 5 char of component type.
          const id = component.id ?
                     component.id :
                     deviceKeys[index] + "-" + component.type.substring(0, 5);
          if (!hub.getHubChannel(id)) {
            hub.addHubChannel(HubChannel.create({
              id,
              type: component.type,
              dir: component.dir,
              model,
              units,
              value: ""}));
          }
        });
      });
    }
    this.requestSensorInfo(hubName);
  }

  private processSensorsMessage(hubName: string, message: any) {
    const  { hubStore } = this.stores;
    const hub = hubStore.getHubByName(hubName);
    if (hub !== undefined) {
      hub.setOnlineStatus(true);
      for (const key in message) {
        if (message.hasOwnProperty(key) && key !== "time") {
          hub.setHubChannelValue(key, message[key]);
        }
      }
    }
  }

  private startMqttClient(credentials: AWS.Credentials)  {
    const { accessKeyId, secretAccessKey, sessionToken } = credentials;

    const url = getSignedUrl(AWS_IOT_ENDPOINT_HOST, AWS_REGION, {
      accessKeyId,
      secretAccessKey,
      sessionToken
    });
    this.client = connect(url);
    this.client.on("message", (topic, rawMessage) => {
      const message = JSON.parse(rawMessage as any);
      const topicParts = topic.split("/");
      if (topicParts[3] === "devices") {
        this.processDevicesMessage(topicParts[2], message);
      } else if (topicParts[3] === "sensors") {
        this.processSensorsMessage(topicParts[2], message);
      }
    });
  }
}
