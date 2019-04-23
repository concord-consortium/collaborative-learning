import { MqttClient, connect } from "mqtt";
import { IStores } from "../models/stores/dataflow-stores";
import { getSignedUrl } from "../utilities/aws";
import * as AWS from "aws-sdk";

const AWS_REGION = "us-east-1";
const COGNITO_POOL = "us-east-1:153d6337-3421-4c34-a21f-d1d2143a5091";
const AWS_IOT_ENDPOINT_HOST = "a2zxjwmcl3eyqd-ats.iot.us-east-1.amazonaws.com";
const MQTT_TOPIC = "test_topic";

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
    this.updateThings();
    this.thingListener = setInterval(this.updateThings, 5000);
  }

  private updateThings() {
    const  { thingStore } = this.stores;
    this.iotCore.listThings().promise().then(data => {
      if (data && data.things) {
        data.things.forEach(thing => {
          const { thingName, thingArn, thingTypeName } = thing;
          if (thingName && thingArn && !thingStore.getThing(thingArn)) {
            thingStore.addThing({
              thingName,
              thingArn,
              thingTypeName: thingTypeName ? thingTypeName : undefined
            });
          }
        });
      }
    });
  }

  private startMqttClient(credentials: AWS.Credentials)  {
    const  { thingStore } = this.stores;
    const { accessKeyId, secretAccessKey, sessionToken } = credentials;

    const url = getSignedUrl(AWS_IOT_ENDPOINT_HOST, AWS_REGION, {
      accessKeyId,
      secretAccessKey,
      sessionToken
    });
    this.client = connect(url);
    this.client.subscribe(MQTT_TOPIC);
    this.client.on("message", (topic, rawMessage) => {
      const message = JSON.parse(rawMessage as any);
      const { client: clientName, value } = message;
      if (this.client && value) {
        const thing = thingStore.things.get(clientName);
        if (thing) {
          thing.setValue(value);
        }
      }
    });
  }
}
