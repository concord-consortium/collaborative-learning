// This requires the modern firebase-admin, so it can't be used by functions-v1
import {Timestamp, getFirestore} from "firebase-admin/firestore";
import {getDatabase} from "firebase-admin/database";

const HOUR = 1000 * 60 * 60;

interface Logger {
  info(...args: any[]): void;
}

interface Params {
  appMode: "qa" | "dev";
  hoursAgo: number;
  logger: Logger;
  dryRun?: boolean;
}

export async function cleanFirebaseRoots(
  { appMode, hoursAgo, logger, dryRun }: Params
) {

  // Be extra careful so we don't delete production data
  if (!["qa", "dev"].includes(appMode)) {
    throw new Error(`Invalid appMode ${appMode}`);
  }

  // Clean up Firestore and Realtime database roots that haven't been updated in a 6 hours
  const cutOffMillis = Date.now() - hoursAgo*HOUR;
  const qaRootsResult = await getFirestore()
    .collection(appMode)
    .where("lastLaunchTime", "<", Timestamp.fromMillis(cutOffMillis))
    .get();

  logger.info(`Found ${qaRootsResult.size} roots to delete`);

  // Need to be careful to clean up the root in the realtime database
  // first. The record in Firestore is our only way to figure out which
  // roots in the realtime database need to be deleted.
  for (const root of qaRootsResult.docs) {
    // The Realtime database root is deleted first incase it fails.
    // This way the root in firestore will remain so we can find it
    // and try again later.
    const databasePath = `/${appMode}/${root.id}`;
    logger.info(`Deleting Realtime Database root: ${databasePath} ...`);
    if (!dryRun) await getDatabase().ref(`/${appMode}/${root.id}`).remove();
    logger.info(`Deleting Firestore root: ${root.ref.path} ...`);
    if (!dryRun) await getFirestore().recursiveDelete(root.ref);
  }

}
