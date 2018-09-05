import * as firebase from "firebase";
import { IStores } from "../models/stores";
import { onSnapshot } from "mobx-state-tree";
import { IDisposer } from "mobx-state-tree/dist/utils";

export class ModelDBConnector {
  private stores: IStores;
  private groupRef: firebase.database.Reference | null = null;
  private groupSnapshotDisposer: IDisposer | null = null;
  private onSynced: () => void;

  constructor(stores: IStores, onSynced: () => void) {
    this.stores = stores;
    this.onSynced = onSynced;
  }

  public startListeners() {
    this.startGroupListener();
  }

  public stopListeners() {
    this.stopGroupListener();
  }

  private startGroupListener() {
    const {db, user, ui} = this.stores;
    this.groupRef = db.getUserGroupRef(user);
    this.groupRef.on("value", this.handleGroupRef);

    this.groupSnapshotDisposer = onSnapshot(user, (newUser) => {
      if (this.groupRef) {
        this.groupRef.set(newUser.group).catch((error) => {
          ui.setError(error);
        });
      }
    });
  }

  private stopGroupListener() {
    if (this.groupRef) {
      this.groupRef.off("value", this.handleGroupRef);
    }
    if (this.groupSnapshotDisposer) {
      this.groupSnapshotDisposer();
    }
  }

  private handleGroupRef = (snapshot: firebase.database.DataSnapshot) => {
    this.stores.user.setGroup(snapshot.val());
    this.onSynced();
  }
}
