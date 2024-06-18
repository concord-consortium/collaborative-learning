import firebase from "firebase/app";
import { DB } from "../db";
import { BaseListener } from "./base-listener";
import { ENavTab } from "../../models/view/nav-tabs";
import { AudienceEnum, AudienceModel } from "../../models/stores/supports";
import { createStickyNote } from "../../models/curriculum/support";

/**
 * Watches the location `/classes/[ID]/users[ID]/exemplars`
 * and maintains the list of exemplar documents that are visible
 * to this user in the `documents` store.
 */
export class DBExemplarsListener extends BaseListener {
  private db: DB;
  private exemplarsRef: firebase.database.Reference;

  constructor(db: DB) {
    super("DBExemplarsListener");
    this.db = db;
  }

  public start() {
    const tabNames = this.db.stores.tabsToDisplay.map(tab => tab.tab);
    const usesSortWork = tabNames.includes(ENavTab.kSortWork);
    if (!usesSortWork) return Promise.resolve();
    const { user } = this.db.stores;
    const exemplarsPath = this.db.firebase.getUserExemplarsPath(user);
    this.exemplarsRef = this.db.firebase.ref(exemplarsPath);
    this.debugLogHandlers("#start", "adding", ["child_added", "child_removed", "child_changed"], this.exemplarsRef);
    this.exemplarsRef.on("child_added", this.handleExemplarAddedOrChanged);
    this.exemplarsRef.on("child_changed", this.handleExemplarAddedOrChanged);
    this.exemplarsRef.on("child_removed", this.handleExemplarRemoved);
  }

  public stop() {
    if (this.exemplarsRef) {
      this.debugLogHandlers("#stop", "removing", ["child_added", "child_removed", "child_changed"], this.exemplarsRef);
      this.exemplarsRef.off("child_added", this.handleExemplarAddedOrChanged);
      this.exemplarsRef.off("child_changed", this.handleExemplarAddedOrChanged);
      this.exemplarsRef.off("child_removed", this.handleExemplarRemoved);
      }
  }

  private handleExemplarAddedOrChanged = (snapshot: firebase.database.DataSnapshot) => {
    if (snapshot.key === 'state') return;
    const hiddenExemplars = this.db.stores.appConfig.initiallyHideExemplars;
    if (!hiddenExemplars) return; // no need to mark visible; all should already be visible.
    // Each child (other than "state") should have a key that is an exemplar document ID, and a 'visible' boolean value.
    const exemplarId = snapshot.key;
    if (exemplarId) {
      this.updateExemplarBasedOnValue(exemplarId, snapshot.val());
    }
  };

  private handleExemplarRemoved = (snapshot: firebase.database.DataSnapshot) => {
    const exemplarId = snapshot.key;
    if (exemplarId) {
      this.db.stores.documents.setExemplarVisible(exemplarId, false);
    }
  };

  private updateExemplarBasedOnValue = (exemplarId: string, value: any) => {
    const visible = typeof value === "object" && value !== null && "visible" in value && value.visible;
    this.db.stores.documents.setExemplarVisible(exemplarId, visible);
    if (visible) {
      // Create sticky note notification if there isn't one already
      const note = this.db.stores.supports.getStickyNoteForUserWithLink(this.db.stores.user.id, exemplarId);
      if (!note) {
        const audience = AudienceModel.create({type: AudienceEnum.user, identifier: this.db.stores.user.id});
        const message = "Nice work, you can now see a new example for this lesson:";
        this.db.createSupport(createStickyNote(message, exemplarId), "", audience);
      }
    }
  };

}

