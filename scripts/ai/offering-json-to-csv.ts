import fs from "fs";

import { datasetPath } from "./script-constants.js";
const sourceDirectory = "dataset1724085367882";
const sourcePath = `${datasetPath}${sourceDirectory}`;
const offeringInfoFile = `${sourcePath}/offering-info.json`;
const offeringInfo = JSON.parse(fs.readFileSync(offeringInfoFile, "utf8"));

// eslint-disable-next-line prefer-regex-literals
const clueBranchRegExp = new RegExp("^https://[^/]*(/[^?]*)");
export function getClueBranch(activityUrl: string) {
  return clueBranchRegExp.exec(activityUrl)?.[1];
}

// eslint-disable-next-line prefer-regex-literals
const unitParamRegExp = new RegExp("unit=([^&]*)");
export function getUnitParam(activityUrl: string) {
  return unitParamRegExp.exec(activityUrl)?.[1];
}

// eslint-disable-next-line prefer-regex-literals
const unitBranchRegExp = new RegExp("/branch/[^/]*");
export function getUnitBranch(unitParam: string | undefined) {
  if (unitParam?.startsWith("https://")) {
    return unitBranchRegExp.exec(unitParam)?.[0];
  } else {
    return "";
  }
}

// eslint-disable-next-line prefer-regex-literals
const unitCodeRegExp = new RegExp("/([^/]*)/content.json");
export function getUnitCode(unitParam: string | undefined) {
  if (unitParam?.startsWith("https://")) {
    const unitCode = unitCodeRegExp.exec(unitParam)?.[1];
    return unitCode ? unitCode : null;
  } else {
    return unitParam ? unitParam : null;
  }
}

console.log("offering_id, activity_url, class_id, clazz_hash, clue_branch, unit_param, unit_branch, unit_code");
Object.entries(offeringInfo).forEach(([offering_id, offering]) => {
  const {activity_url, clazz_id, clazz_hash} = offering as any;
  const clueBranch = getClueBranch(activity_url);
  const unitParam = getUnitParam(activity_url);
  const unitBranch = getUnitBranch(unitParam);
  const unitCode = getUnitCode(unitParam);
  console.log(
    `${offering_id}, ${activity_url}, ${clazz_id}, ${clazz_hash}, ` +
    `${clueBranch}, ${unitParam}, ${unitBranch}, ${unitCode}`);
});
