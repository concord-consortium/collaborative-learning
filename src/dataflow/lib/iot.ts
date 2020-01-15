import { MqttClient, connect } from "mqtt";
import * as AWS from "aws-sdk";
import { IStores } from "../models/stores/dataflow-stores";
import { getSignedUrl } from "../utilities/aws";
import { HubChannelModel } from "../models/stores/hub-store";
import { safeJsonParse } from "../../utilities/js-utils";

const AWS_REGION = "us-east-1";
const COGNITO_POOL = "us-east-1:153d6337-3421-4c34-a21f-d1d2143a5091";
const AWS_IOT_ENDPOINT_HOST = "a2zxjwmcl3eyqd-ats.iot.us-east-1.amazonaws.com";
// TODO: This is for testing purposes only. Remove when we add users and hub owners.
const OWNER_ID = "123";
const SEND_INTERVAL = 1;
const MAX_HUBS = 200;
const HUB_RESPONSE_TIMEOUT = 30 * 1000;
const CHANNEL_REMOVE_TIMEOUT = 300 * 1000;

type RelayValue = 0 | 1;

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

export function fixMqttMessage(msg: string) {
  let match;
  // Capturing groups: (1) leading comma, (2) bad plug message, (3) trailing comma
  const strMatch = (str: string) => match = str.match(/(,?)("":{"version":, "plug":\d, "components": \[\]})(,?)/);
  while (strMatch(msg) && match) {
    const replaceStr = match[1] && match[3] ? "," : "";
    msg = msg.replace(match[0], replaceStr);
  }
  return msg;
}

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

  public refreshAllHubsChannelInfo() {
    const  { hubStore } = this.stores;
    hubStore.hubs.forEach(hub => {
      hub.removeAllHubChannels();
      hub.setHubUpdateTime(Date.now());
      this.requestHubChannelInfo(hub.hubId);
    });
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
    const currentTime = Date.now();
    // check for hubs that have not responded recently
    hubStore.hubs.forEach(hub => {
      if ((currentTime - hub.hubUpdateTime) > HUB_RESPONSE_TIMEOUT && hub.hubChannels.length) {
        hub.setAllHubChannelsMissingState(true);
        this.requestHubChannelInfo(hub.hubId);
      } else if ((currentTime - hub.hubUpdateTime) > CHANNEL_REMOVE_TIMEOUT && hub.hubChannels.length) {
        hub.removeAllHubChannels();
        this.requestHubChannelInfo(hub.hubId);
      }
      const rids: string[] = [];
      hub.hubChannels.forEach(ch => {
        if ((currentTime - ch.lastUpdateTime) > CHANNEL_REMOVE_TIMEOUT && ch.missing) {
          rids.push(ch.id);
        }
      });
      rids.forEach(id => { hub.removeHubChannel(id); });
    });

    const requestParams: AWS.Iot.ListThingsRequest = { maxResults: MAX_HUBS };
    this.iotCore.listThings(requestParams).promise().
      then(data => {
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
              this.client.subscribe(this.createTopic(OWNER_ID, hubId, TopicType.hubChannelInfo), { qos: 1 });
              this.client.subscribe(this.createTopic(OWNER_ID, hubId, TopicType.hubSensorValues), { qos: 1 });
              this.requestHubChannelInfo(hubId);
              // TODO: this call sometimes causes AWS network errors
              // remove for now as we do not currently use thing groups
              // will need to add this back later if we intend to sort hubs based on group
              // this.requestThingGroups(hubId);
            }
          });
        }
      })
      .catch(error => {
        console.error("IoT.updateHubs: error calling listThings");
      });
  }

  private requestThingGroups = (hubId: string) => {
    const params: any = {
      thingName: hubId
    };
    const  { hubStore } = this.stores;
    const hub = hubStore.getHubById(hubId);
    this.iotCore.listThingGroupsForThing(params).promise()
      .then(data => {
        if (data && data.thingGroups && hub) {
          data.thingGroups.forEach(group => {
            if (group.groupName && !hub.hubGroups.includes(group.groupName)) {
              hub.addHubGroup(group.groupName);
            }
          });
        }
      })
      .catch(error => {
        console.error("IoT.requestThingGroups: error calling listThingGroupsForThing with id =", hubId);
      });
  }

  private createTopic(ownerID: string, hubId: string, topicType: TopicType) {
    return (`${ownerID}/hub/${hubId}/${TopicInfo[topicType].leafLevel}`);
  }

  private startSendingSensorValues(hubId: string) {
    const topicMessage = JSON.stringify({ command: "set_send_interval", send_interval: SEND_INTERVAL});
    this.client.publish(this.createTopic(OWNER_ID, hubId, TopicType.hubCommand), topicMessage, { qos: 1 });

  }
  private requestHubChannelInfo(hubId: string) {
    const topicMessage = JSON.stringify({ command: "req_devices"});
    this.client.publish(this.createTopic(OWNER_ID, hubId, TopicType.hubCommand), topicMessage, { qos: 1 });
  }

  private controlRelay(hubId: string, relayId: string, value: RelayValue) {
    const topicObj = { [relayId]: value };
    const topicMessage = JSON.stringify(topicObj);
    this.client.publish(this.createTopic(OWNER_ID, hubId, TopicType.hubRelays), topicMessage, { qos: 1 });
  }

  private processHubChannelInfoMessage(hubId: string, message: any) {
    const  { hubStore } = this.stores;
    const hub = hubStore.getHubById(hubId);
    const currentTime = Date.now();
    if (hub) {
      hub.setHubUpdateTime(currentTime);
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
          const plug = device.plug || 0;
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
              lastUpdateTime: currentTime,
              missing: false,
              plug}));
          } else {
            hub.setHubChannelMissingState(id, false);
            hub.setHubChannelTime(id, currentTime);
          }
        });
      });
      // set unused channels to missing state
      rids.forEach(id => {
        hub.setHubChannelMissingState(id, true);
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
    let hubStoreSensors = 0;
    if (hub) {
      hub.setHubUpdateTime(Date.now());
      let messageChannels = 0;
      let unmatchedChannel = false;
      for (const key in message) {
        if (message.hasOwnProperty(key) && key !== "time") {
          messageChannels++;
          if (hub.getHubChannel(key)) {
            hub.setHubChannelValue(key, String(message[key]));
            hub.setHubChannelTime(key, time);
          } else {
            unmatchedChannel = true;
          }
        }
      }

      // TODO: simulator doesn't currently return relay value in sensors message
      // until fixed, need to handle both the hub and hub sim cases
      hub.hubChannels.forEach(ch => {
        if (ch.type !== "relay") {
          hubStoreSensors++;
        }
      });

      // TODO: change to below once we fix the simulator so that it returns relay value with sensors message
      // if (messageChannels !== hub.hubChannels.length || unmatchedChannel) {
      if ((messageChannels !== hub.hubChannels.length && messageChannels !== hubStoreSensors) || unmatchedChannel) {
        this.requestHubChannelInfo(hub.hubId);
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
    this.client.on("message", this.handleMqttMessage);
  }

  private handleMqttMessage = (topic: string, payload: Buffer) => {
    const { hubId, leafLevel } = this.parseTopic(topic);
    const rawMessage = payload.toString();
    const fixedMessage = fixMqttMessage(rawMessage);
    const wasMalformed = fixedMessage !== rawMessage;
    const message = safeJsonParse(fixedMessage);
    if (message) {
      if (wasMalformed) {
        console.warn("IoT.handleMqttMessage: Fixed invalid message -- topic:", topic, "payload:", rawMessage);
      }
      if (leafLevel === "devices") {
        this.processHubChannelInfoMessage(hubId, message);
      } else if (leafLevel === "sensors") {
        this.processSensorValuesMessage(hubId, message);
      }
    }
    else {
      console.error("IoT.handleMqttMessage: Skipped invalid message -- topic:", topic, "payload:", rawMessage);
    }
    if ((!message || wasMalformed) && hubId) {
      this.requestHubChannelInfo(hubId);
    }
  }

  private parseTopic(topic: string) {
    const topicParts = topic && topic.split("/");
    return { ownerId: topicParts[0], hubId: topicParts[2], leafLevel: topicParts[3] };
  }
}
