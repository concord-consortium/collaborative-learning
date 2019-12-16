import * as AWS from "aws-sdk";
import { NodeEditor } from "rete";

const getUtils = () => {
  return (AWS as any).util;
};

// cf. https://docs.aws.amazon.com/iot/latest/developerguide/mqtt-ws.html
const getSignatureKey = (key: string, date: any, region: any, service: any) => {
    const kDate = getUtils().crypto.hmac("AWS4" + key, date, "buffer");
    const kRegion = getUtils().crypto.hmac(kDate, region, "buffer");
    const kService = getUtils().crypto.hmac(kRegion, service, "buffer");
    const kCredentials = getUtils().crypto.hmac(kService, "aws4_request", "buffer");
    return kCredentials;
};

export const getSignedUrl = (
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

export function uploadProgram(programData: NodeEditor): string {
  if (!programData) {
    return "failed";
  }
  const uploadableProgram = JSON.stringify(programData);
  const lambda = new AWS.Lambda({region: "us-east-1", apiVersion: "2015-03-31"});
  const params = {
    FunctionName: "arn:aws:lambda:us-east-1:816253370536:function:createDataflowProgram",
    Payload: uploadableProgram,
    InvocationType: "RequestResponse",
    LogType: "Tail"
  };
  lambda.invoke(params, (error, data) => {
    if (error) {
      return("error " +  error);
    }
    if (data) {
      return ("success " + data);
    }
  });
  return "completed";
}

export function deleteProgram(endTime: number): string {
  const lambda = new AWS.Lambda({region: "us-east-1", apiVersion: "2015-03-31"});
  const params = {
    FunctionName: "arn:aws:lambda:us-east-1:816253370536:function:deleteDataflowProgram",
    Payload: JSON.stringify({endTime}),
    InvocationType: "RequestResponse",
    LogType: "Tail"
  };
  lambda.invoke(params, (error, data) => {
    if (error) {
      return("error " +  error);
    }
    if (data) {
      return ("success " + data);
    }
  });
  return "completed";
}

interface ProgramDataCache {
  lastTimestamp: number;
  data: ProgramDataPoint[];
}

interface ProgramDataPoint{
  time: number;
  values: number[];
  blockIds: number[];
}

const allProgramsCache: {[programId: string]: ProgramDataCache} = {};

export const fetchActiveRelays = () => {
  const lambda = new AWS.Lambda({ region: "us-east-1", apiVersion: "2015-03-31" });
  const params = {
    FunctionName: "arn:aws:lambda:us-east-1:816253370536:function:fetchActiveRelays",
    Payload: JSON.stringify({}),
    InvocationType: "RequestResponse",
    LogType: "Tail"
  };
  return new Promise((resolve, reject) => {
    lambda.invoke(params, (error, data) => {
      if (error) {
        reject(error);
      }
      if (data && data.Payload) {
        let payload: any;
        try {
          payload = JSON.parse(data.Payload as string);
        } catch (e) {
          // In case of strange messages in MQTT, handle a glitch gracefully
          resolve({});
        }
        resolve(payload);
      }
    });
  });
};

export const fetchProgramData = (programId: string, time?: number, endTime?: number) => {
  // Omitting the time parameter returns all program data from the start
  // Omitting the endTime returns all data from the start time and now
  // time and endTime togethercan be passed to specify a range between the start time and endTime
  const cachedProgram = allProgramsCache[programId];
  const startTime = time ? time : cachedProgram ? cachedProgram.lastTimestamp : undefined;
  const queryParams = { programId, time: startTime, endTime };
  const lambda = new AWS.Lambda({ region: "us-east-1", apiVersion: "2015-03-31" });
  const params = {
    FunctionName: "arn:aws:lambda:us-east-1:816253370536:function:fetchProgramData",
    Payload: JSON.stringify(queryParams),
    InvocationType: "RequestResponse",
    LogType: "Tail"
  };
  return new Promise((resolve, reject) => {
    if (!programId) {
      reject ("no programId specified");
    }
    lambda.invoke(params, (error, data) => {
      if (error) {
        reject(error);
      }
      if (data && data.Payload) {
        const result: any = { count: 0 };
        let payload: any;
        try {
          payload = JSON.parse(data.Payload as string);
        } catch (e) {
          // In case of strange messages in MQTT, handle a glitch gracefully
          resolve(result);
        }
        if (payload.data) {
          // Add latest data to cache
          addDataPoints(programId, JSON.parse(data.Payload as string));
          result.count = allProgramsCache[programId].data ? allProgramsCache[programId].data.length : 0;
          result.data = allProgramsCache[programId].data;
        }
        resolve(result);
      }
    });
  });
};

const addDataPoints = (programId: string, payload: any) => {
  let mostRecentTimestamp = 0;
  const dataPoints: ProgramDataPoint[] = [];
  for (const timeData of payload.data){
    const p: ProgramDataPoint = {
      time: timeData.time,
      values: timeData.values,
      blockIds: timeData.blockIds
    };

    mostRecentTimestamp = timeData.time > mostRecentTimestamp ? timeData.time : mostRecentTimestamp;
    dataPoints.push(p);
  }
  if (!allProgramsCache || !allProgramsCache[programId]) {
    allProgramsCache[programId] = { lastTimestamp: mostRecentTimestamp, data: dataPoints };
  } else {
    // append new points to existing set
    for (const v of dataPoints) {
      if (v.time > allProgramsCache[programId].lastTimestamp) {
        allProgramsCache[programId].data.push(v);
        allProgramsCache[programId].lastTimestamp = v.time;
      }
    }
  }
};
