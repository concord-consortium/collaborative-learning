import firebase from "firebase/app";
import { DB } from "../db";
import { DBOfferingGroupMap } from "../db-types";
import { map } from "lodash";
import { BaseListener } from "./base-listener";

export class DBGroupsListener extends BaseListener {
  private db: DB;
  private groupsRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    super("DBGroupsListener");
    this.db = db;
  }

  public start() {
    return new Promise<void>((resolve, reject) => {
      const { user, groups } = this.db.stores;
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
  }

  private handleGroupsRef = (snapshot: firebase.database.DataSnapshot) => {
    const { user } = this.db.stores;
    const groups: DBOfferingGroupMap = snapshot.val() || {};
    const myGroupIds: string[] = [];
    const overSubscribedUserUpdates: any = {};

    this.debugLogSnapshot("#handleGroupsRef", snapshot);

    // ensure that the current user is not in more than 1 group and groups are not oversubscribed
    Object.keys(groups).forEach((groupId) => {
      const rawUsers = groups[groupId].users || {};
      // rawUsers can get interpreted as an array instead of a map if user IDs are small (e.g. in demo mode)
      // So, make sure to filter out empty array spaces and convert number IDs to strings for standardization
      const groupUsers = map(rawUsers, (groupUser, uid) => ({ uid: `${uid}`, user: groupUser }))
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
