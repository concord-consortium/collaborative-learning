import { MqttClient, connect } from "mqtt";
import { IStores } from "../models/stores/dataflow-stores";
import { getSignedUrl } from "../utilities/aws";
import { HubChannelModel } from "../models/stores/hub-store";
import * as AWS from "aws-sdk";

const AWS_REGION = "us-east-1";
const COGNITO_POOL = "us-east-1:153d6337-3421-4c34-a21f-d1d2143a5091";
const AWS_IOT_ENDPOINT_HOST = "a2zxjwmcl3eyqd-ats.iot.us-east-1.amazonaws.com";
// WTD This is for testing purposes only. Remove when we add users and hub owners.
const OWNER_ID = "123";
// WTD This is for testing purposes only. Sensor send interval should be set by user.
const SEND_INTERVAL = 2;

export enum TopicType {
  hubChannelInfo = "hubChannelInfo",
  hubSensorValues = "hubSensorValues",
  hubStatus = "hubStatus",
  hubCommand = "hubCommand",
  hubRelays = "hubRelays"
}

export const TopicInfo = {
  [TopicType.hubChannelInfo]: { leafLevel: "devices" },
  [TopicType.hubSensorValues]: { leafLevel: "sensors" },
  [TopicType.hubStatus]: { leafLevel: "status" },
  [TopicType.hubCommand]: { leafLevel: "command" },
  [TopicType.hubRelays]: { leafLevel: "actuators" }
};

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
          // use attribute name when available (some things may not include it)
          const hubId = thingName || "N/A";
          const hubName = thing.attributes && thing.attributes.name || hubId;
          const hubProviderId = thingArn;
          const hubType = thingTypeName;
          if (hubId && hubProviderId && !hubStore.getHub(hubProviderId)) {
            hubStore.addHub({
              hubId,
              hubProviderId,
              hubType: hubType ? hubType : undefined,
              hubName,
              hubChannels: [],
              hubUpdateTime: Date.now()
            });
            // subscribe to any necessary topics for the new thing
            this.client.subscribe(this.createTopic(OWNER_ID, hubId, TopicType.hubChannelInfo));
            this.client.subscribe(this.createTopic(OWNER_ID, hubId, TopicType.hubSensorValues));
            this.requestHubChannelInfo(hubId);
          }
        });
      }
    });
  }

  private createTopic(ownerID: string, hubId: string, topicType: TopicType) {
    return (`${ownerID}/hub/${hubId}/${TopicInfo[topicType].leafLevel}`);
  }

  private startSendingSensorValues(hubId: string) {
    const topicMessage = JSON.stringify({ command: "set_send_interval", send_interval: SEND_INTERVAL});
    this.client.publish(this.createTopic(OWNER_ID, hubId, TopicType.hubCommand), topicMessage);

  }
  private requestHubChannelInfo(hubId: string) {
    const topicMessage = JSON.stringify({ command: "req_devices"});
    this.client.publish(this.createTopic(OWNER_ID, hubId, TopicType.hubCommand), topicMessage);
  }

  private processHubChannelInfoMessage(hubId: string, message: any) {
    const  { hubStore } = this.stores;
    const hub = hubStore.getHubById(hubId);
    if (hub) {
      const devices = Object.values(message);
      const deviceKeys = Object.keys(message);
      let rids: string[] = [];
      hub.hubChannels.forEach(ch => {
        rids.push(ch.id);
      });
      // hub may have 1 or more devices
      devices.forEach((device: any, index: number) => {
        // device may have 1 or more components (called "channels" in Dataflow)
        device.components.forEach((channel: any) => {
          // add channels to hub (may be sensor or relay)
          const model = channel.model || "N/A";
          const units = channel.units || "";
          const id = this.constructHubChannelId(channel.id, deviceKeys[index], channel.type);
          rids = rids.filter(rid => rid !== id);
          if (!hub.getHubChannel(id)) {
            hub.addHubChannel(HubChannelModel.create({
              id,
              type: channel.type,
              dir: channel.dir,
              model,
              units,
              value: "",
              lastUpdateTime: Date.now()}));
          }
        });
      });
      // remove unused channels
      rids.forEach(id => {
        hub.removeHubChannel(id);
      });
    }
    this.startSendingSensorValues(hubId);
  }

  private constructHubChannelId(channelId: string, deviceId: string, type: string) {
    // channel id is equivalent to the component id in the hub message
    // in some cases the component id is not in the message explicitly
    // and needs to be constructed.
    // component id has form "deviceid-componenttypeprefix" where
    // componenttypeprefix is first 5 char of component type.
    return (channelId ? channelId : deviceId + "-" + type.substring(0, 5));
  }

  private processSensorValuesMessage(hubId: string, message: any) {
    const  { hubStore } = this.stores;
    const hub = hubStore.getHubById(hubId);
    const time = message.time ? parseFloat(message.time) * 1000 : Date.now();
    if (hub) {
      for (const key in message) {
        if (message.hasOwnProperty(key) && key !== "time") {
          hub.setHubChannelValue(key, message[key]);
          hub.setHubChannelTime(key, time);
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
      const { hubId, leafLevel } = this.parseTopic(topic);
      if (leafLevel === "devices") {
        this.processHubChannelInfoMessage(hubId, message);
      } else if (leafLevel === "sensors") {
        this.processSensorValuesMessage(hubId, message);
      }
    });
  }

  private parseTopic(topic: string) {
    const topicParts = topic && topic.split("/");
    return { ownerId: topicParts[0], hubId: topicParts[2], leafLevel: topicParts[3] };
  }
}
