import { IStores } from "../models/stores/stores";
import { escapeKey } from "./fire-utils";

type IRootDocIdStores = Pick<IStores, "appMode" | "demo" | "user">;

export function getRootId(stores: IRootDocIdStores, firebaseUserId: string) {
  const { appMode, demo: { name: demoName }, user: { portal } } = stores;
  const escapedPortal = portal ? escapeKey(portal) : portal;

  switch (appMode) {
    case "authed": {
      return escapedPortal;
    }
    case "demo": {
      // Legacy Note: Previously if the demoName was "", the root id in the realtime database
      // and Firestore would be different. The paths would end up being:
      // database: /demo/portals/demo/ (root id is skipped)
      // firestore: /demo/{firebaseUserId}/
      // Now the root id will be the default "demo" in this case so the paths will be:
      // database: /demo/demo/portals/demo/
      // firestore: /demo/demo/
      const escapedDemoName = demoName ? escapeKey(demoName) : demoName;
      return escapedDemoName || escapedPortal || "demo";
    }
    // "dev", "qa", and "test"
    default: {
      return firebaseUserId;
    }
  }
}
