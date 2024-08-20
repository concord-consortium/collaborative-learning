import fs from "fs";
import { getClueBranch, getUnitParam, getUnitBranch, getUnitCode } from "../lib/script-utils.js";

import { datasetPath } from "./script-constants.js";
const sourceDirectory = "dataset1724085367882";
const sourcePath = `${datasetPath}${sourceDirectory}`;
const offeringInfoFile = `${sourcePath}/offering-info.json`;
const offeringInfo = JSON.parse(fs.readFileSync(offeringInfoFile, "utf8"));

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
