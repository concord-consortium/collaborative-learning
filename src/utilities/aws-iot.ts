import * as AWS from "aws-sdk";

// Credentials for limited account iot-test-user2 available in 1Password
const ak = "ACCESS_KEY";
const sk = "SECRET_KEY";

export function listThings(callback: any) {
  const iot = new AWS.Iot({
    region: "us-east-1",
    accessKeyId: ak,
    secretAccessKey: sk,
  });

  if (sk.length < 10) {
    return ("No credentials supplied");
  } else {
    iot.listThings({}, (err, data) => {
      if (err) callback(err); // console.log(err, err.stack); // an error occurred
      else { // console.log(data);           // successful response
        callback(data);
      }
    });
  }
}
