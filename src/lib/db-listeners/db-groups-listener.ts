import firebase from "firebase/app";
import { DB, Monitor } from "../db";
import { DBOfferingGroupMap } from "../db-types";
import { ProblemDocument } from "../../models/document/document-types";
import { map } from "lodash";
import { BaseListener } from "./base-listener";
import { autorun } from "mobx";

export class DBGroupsListener extends BaseListener {
  private db: DB;
  private groupsRef: firebase.database.Reference | null = null;
  private groupsMonitorDisposer: any;

  constructor(db: DB) {
    super("DBGroupsListener");
    this.db = db;
  }

  public start() {
    // TODO: we probably want to improve this so each new document
    // doesn't trigger a bunch of monitor and unmonitor calls
    // If we had the list of documents to monitor and we could get
    // the list of documents that were currently monitored, then
    // we could just rerun the code if the list to monitor changes
    // and when it changes we could unmonitor everything not in the list
    // that is a Problem document.
    //
    // Ideally we'd have a computed value which was the documents to
    // monitor. We don't have a good place to put computed values like
    // this, other than making a new MST Object. And this would just
    // be for students without additional work so the documents
    // are only monitored. To make it worse the documents start out
    // monitored.
    //
    // This is important for this reason:
    // https://firebase.google.com/docs/firestore/best-practices#realtime_updates
    this.groupsMonitorDisposer = autorun(() => {
      console.log("running groupsMonitor");
      const {user, groups, documents} = this.db.stores;

      // in teacher mode we listen to all documents and the document's group might change
      // if a student changes groups so we need to gather the updated group id for each
      // student and set it for the student's problem documents
      documents.byType(ProblemDocument).forEach((document) => {
        const groupId = groups.groupIdForUser(document.uid);
        document.setGroupId(groupId);

        // enable/disable monitoring of other students' documents when groups change
        if (user.isStudent && (document.uid !== user.id)) {
          // students only monitor documents in their group to save bandwidth
          if (document.groupId === user.currentGroupId) {
            // ensure the group document is monitored
            this.db.listeners.monitorDocument(document, Monitor.Remote);
          }
          else {
            // ensure we don't monitor documents outside the group
            this.db.listeners.unmonitorDocument(document, Monitor.Remote);
          }
        }
      });

    });

    return new Promise<void>((resolve, reject) => {
      const {user, groups} = this.db.stores;
      const groupsRef = this.groupsRef = this.db.firebase.ref(this.db.firebase.getGroupsPath(user));

      // use once() so we are ensured that groups are set before we resolve
      this.debugLogHandler("#start", "adding", "once", groupsRef);
      groupsRef.once("value")
        .then((snapshot) => {
          const dbGroups: DBOfferingGroupMap = snapshot.val() || {};
          this.debugLogSnapshot("#start", snapshot);
          // Groups may be invalid at this point, but the listener will resolve it once connection times are set
          groups.updateFromDB(dbGroups, this.db.stores.class);

          const group = groups.groupForUser(user.id);
          if (group) {
            // update our connection time so we report as connected/disconnected
            const userRef = this.db.firebase.ref(this.db.firebase.getGroupUserPath(user, group.id));
            return this.db.firebase.setConnectionHandlers(userRef);
          }
          else if (user.latestGroupId) {
            // if we are not currently in a group try to join the latest group
            return this.db.joinGroup(user.latestGroupId);
          }
        })
        .then(() => {
          this.debugLogHandler("#start", "adding", "on value", groupsRef);
          groupsRef.on("value", this.handleGroupsRef);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public stop() {
    if (this.groupsRef) {
      this.debugLogHandler("#stop", "removing", "on value", this.groupsRef);
      this.groupsRef.off("value", this.handleGroupsRef);
      this.groupsRef = null;
    }
    this.groupsMonitorDisposer?.();
  }

  private handleGroupsRef = (snapshot: firebase.database.DataSnapshot) => {
    const {user} = this.db.stores;
    const groups: DBOfferingGroupMap = snapshot.val() || {};
    const myGroupIds: string[] = [];
    const overSubscribedUserUpdates: any = {};

    this.debugLogSnapshot("#handleGroupsRef", snapshot);

    // ensure that the current user is not in more than 1 group and groups are not oversubscribed
    Object.keys(groups).forEach((groupId) => {
      const rawUsers = groups[groupId].users || {};
      // rawUsers can get interpreted as an array instead of a map if user IDs are small (e.g. in demo mode)
      // So, make sure to filter out empty array spaces and convert number IDs to strings for standardization
      const groupUsers = map(rawUsers, (groupUser, uid) => ({uid: `${uid}`, user: groupUser}))
        .filter(groupUser => !!groupUser.user);
      if (groupUsers.find(groupUser => groupUser.uid === user.id)) {
        myGroupIds.push(groupId);
      }
      if (groupUsers.length > 4) {
        // sort the users by connected timestamp and find the newest users to kick out
        groupUsers.sort((a, b) => a.user.connectedTimestamp - b.user.connectedTimestamp);
        for (let i = 4; i < groupUsers.length; i++) {
          const userToRemove = groupUsers[i];
          const userPath = this.db.firebase.getFullPath(
            this.db.firebase.getGroupUserPath(user, groupId, userToRemove.uid)
          );
          overSubscribedUserUpdates[userPath] = null;
        }
      }
    });

    // if there is a problem with the groups fix the problem in the next timeslice
    const numUpdates = Object.keys(overSubscribedUserUpdates).length;
    if ((numUpdates > 0) || (myGroupIds.length > 1)) {
      setTimeout(() => {
        if (numUpdates > 0) {
          firebase.database().ref().update(overSubscribedUserUpdates);
        }
        if (myGroupIds.length > 1) {
          this.db.leaveGroup();
        }
      }, 1);
    }
    else {
      // otherwise set the groups
      this.db.stores.groups.updateFromDB(groups, this.db.stores.class);

      user.setCurrentGroupId(this.db.stores.groups.groupIdForUser(user.id));

    }
  };
}
