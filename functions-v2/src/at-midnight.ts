import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

// NOTE: in order for this import from shared to work it is necessary
// to alias "firebase-admin" in tsconfig.json. Otherwise Typescript will
// read the types from the parent node_modules. The parent directory
// has a different version of the firebase dependencies, which cause
// type errors.
import {cleanFirebaseRoots} from "../../shared/clean-firebase-roots";
import {updateClassDataDocs} from "../../shared/update-class-data-docs";

export const atMidnight = onSchedule(
  {
    // Let the function run for 30 minutes.
    // From early testing it looks like the function can delete 500 qa roots
    // every 5 minutes.
    timeoutSeconds: 1800,
    // Run the function at 7am UTC or 12am PDT
    schedule: "0 7 * * *",
  },
  runAtMidnight
);

// This function is split out so it can be tested by Jest. The
// firebase-functions-test library doesn't support wrapping onSchedule.
export async function runAtMidnight() {
  await cleanFirebaseRoots({
    appMode: "qa",
    hoursAgo: 24,
    logger,
    dryRun: false,
  });

  // When cleanFirebaseRoots is called from a NodeJS script it is
  // necessary to call Firebase's deleteApp so no threads are left running.
  // Inside of a firebase function according to
  // https://stackoverflow.com/a/72933644/3195497
  // it isn't necessary to call deleteApp when the function is done.

  await updateClassDataDocs({
    logger,
  });
  logger.info("atMidnight completed");
}
