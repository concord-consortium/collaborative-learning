import { destroy } from "mobx-state-tree";
import firebase from "firebase/app";
import { getGroupSnapshot, GroupModel } from "../../models/stores/groups";
import { DB } from "../db";
import { DBOfferingGroupMap } from "../db-types";
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
      const {user, groups} = this.db.stores;
      const groupsRef = this.groupsRef = this.db.firebase.ref(this.db.firebase.getGroupsPath(user));

      // use once() so we are ensured that groups are set before we resolve
      this.debugLogHandler("#start", "adding", "once", groupsRef);
      groupsRef.once("value")
        .then((snapshot) => {
          const dbGroups: DBOfferingGroupMap = snapshot.val() || {};
          this.debugLogSnapshot("#start", snapshot);
          // Groups may be invalid at this point, but the listener will resolve it once connection times are set
          this.updateGroupsFromDb(dbGroups);

          // Set currentGroupId immediately so the UI knows the user's group status before the start() promise resolves.
          user.setCurrentGroupId(groups.groupIdForUser(user.id));

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
    const { user, class: clazz } = this.db.stores;
    const groups: DBOfferingGroupMap = snapshot.val() || {};
    const myGroupIds: string[] = [];

    this.debugLogSnapshot("#handleGroupsRef", snapshot);

    // ensure that the current user is not in more than 1 group
    Object.keys(groups).forEach((groupId) => {
      // Create a temporary instance of the MST Group so the same parsing logic is used both here
      // and by updateGroupsFromDb
      const groupSnapshot = getGroupSnapshot(groupId, groups[groupId]);
      const tempGroup = GroupModel.create(groupSnapshot, {class: clazz});

      if (tempGroup.users.find(groupUser => groupUser.id === user.id)){
        myGroupIds.push(groupId);
      }

      destroy(tempGroup);
    });

    if (myGroupIds.length > 1) {
      setTimeout(() => {
        this.db.leaveGroup();
      }, 1);
    }
    else {
      // otherwise set the groups
      this.updateGroupsFromDb(groups);
      user.setCurrentGroupId(this.db.stores.groups.groupIdForUser(user.id));
    }
  };

  private async updateGroupsFromDb(dbGroups: DBOfferingGroupMap) {
    const {groups, class: clazz, portal} = this.db.stores;
    groups.updateFromDB(dbGroups);
    if (!groups.needToRefreshClass) return;

    // FIXME: if a user has launched CLUE and then the teacher removes them from the class, they can
    // keep joining new groups which will make them look like a new user because their "connected" time
    // will be newer than last class info request. Each time they change groups this will immediately
    // trigger a re-request of the class info here. This will reset last class info request time to be
    // newer than the "connected" time of the user. However we have an offset of 1 second before the user
    // is considered removed. So if the class timestamp is less than 1 second newer than the "connected"
    // time of the user, the user will continue to show up as new. Unless the groups in the DB are
    // updated, this removed user will continue to show up as new.
    //
    // For portal launches we can address this by locking CLUE if the current user is no longer in
    // the class. The user could circumvent this in the browser console, but it should be good enough
    // to prevent data loss and deter most people.
    // We currently only do these class refreshes here when the groups change. So if a new student
    // starts CLUE or a student changes groups then this rouge user would effectively be kicked out.
    const classInfo = await portal.getClassInfo();
    if (!classInfo) return;
    const timeOffset = await this.db.firebase.getServerTimeOffset();
    classInfo.serverTimestamp = classInfo.localTimestamp + timeOffset;
    const includeAIUser = this.db.stores.appConfig.aiEvaluation !== undefined;
    clazz.updateFromPortal(classInfo, includeAIUser);
  }
}
