import firebase from "firebase/app";
import {DEBUG_LISTENERS} from "../../lib/debug";
import { firebaseRefPath } from "../fire-utils";

export class BaseListener {
  protected listener: string;

  constructor(listener: string) {
    this.listener = listener;
  }

  protected debugLogHandler(
    methodName: string,
    action: "adding" | "removing",
    handler: string,
    ref: firebase.database.Reference) {
    this.debugLog(methodName, action, handler, "handler for", firebaseRefPath(ref));
  }

  protected debugLogHandlers(
    methodName: string,
    action: "adding" | "removing",
    handlers: string[],
    ref: firebase.database.Reference) {
    this.debugLog(methodName, action, handlers.join(" and "), "handlers for", firebaseRefPath(ref));
  }

  protected debugLogSnapshot(methodName: string, snapshot: firebase.database.DataSnapshot) {
    this.debugLog(methodName, snapshot.val(), "for", firebaseRefPath(snapshot.ref));
  }

  protected debugLog(methodName: string, ...args: any[]) {
    if (DEBUG_LISTENERS) {
      // eslint-disable-next-line no-console
      console.log(`${this.listener}${methodName}`, ...args);
    }
  }
}
