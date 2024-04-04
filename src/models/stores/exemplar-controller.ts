import { applySnapshot, types, onSnapshot } from "mobx-state-tree";
import _ from "lodash";
import { UserModelType } from "./user";
import { DB } from "../../lib/db";
import { safeJsonParse } from "../../utilities/js-utils";
import { LogEventName } from "../../lib/logger-types";
import { DocumentsModelType } from "./documents";
import { LogMessage } from "../../lib/logger";
import { AudienceEnum, AudienceModel } from "./supports";
import { createStickyNote } from "../curriculum/support";

// The database structure of this object is expected to change frequently as we develop
// this feature, so keep an explicit version number to make migrations easier.
const kExemplarControllerStateVersion = "1";

export const ExemplarControllerModel = types
  .model("ExemplarController", {
    version: types.optional(types.literal(kExemplarControllerStateVersion), kExemplarControllerStateVersion),
    drawingActions: 0
  })
  .volatile((self) => ({
    documentsStore: undefined as DocumentsModelType | undefined,
    db: undefined as DB|undefined,
    firebasePath: undefined as string|undefined
  }))
  .actions((self) => ({
    async initialize(user: UserModelType, db: DB) {
      self.db = db;
      self.documentsStore = db.stores.documents;
      self.firebasePath = db.firebase.getUserExemplarsPath(user);
      const statePath = db.firebase.getExemplarStatePath(user);
      const stateRef = db.firebase.ref(statePath);
      const stateVal = (await stateRef.once("value"))?.val();
      const state = safeJsonParse(stateVal);
      console.log("initializing ExemplarController; state=", state);
      if (state) {
        applySnapshot(self, state);
      }

      onSnapshot(self, (snapshot)=>{
        const snapshotStr = JSON.stringify(snapshot);
        const updateRef = db.firebase.ref(statePath);
        updateRef.set(snapshotStr);
      });
    },
    /**
     * Writes to the database to indicate whether the current user has access to the given exemplar.
     */
    setExemplarVisibility(key: string, isVisible: boolean) {
      if (self.db) {
        self.db.firebase.ref(self.firebasePath).child(`${key}/visible`).set(isVisible);
        if (isVisible) {
          // Notify user with a sticky note
          const audience = AudienceModel.create({type: AudienceEnum.user, identifier: self.db.stores.user.id});
          const message = "Nice work, you can now see a new example for this lesson:";
          self.db.createSupport(createStickyNote(message, key), "", audience);
        }
      }
    }
  }))
  .actions((self) => ({
    /**
     * Writes to the database to clear any visible exemplars.
     */
    resetAllExemplars() {
      for (const key of self.documentsStore?.visibleExemplars || []) {
        self.setExemplarVisibility(key, false);
      }
    },
    /**
     * Makes any appropriate changes to exemplars based on the current state.
     * This should be called after any state changes that may require action.
     */
    updateExemplars() {
      // At the moment we only have one rule: after 3 drawing actions are recorded, reveal a random exemplar.
      if (self.drawingActions >= 3) {
        const chosen = _.sample(self.documentsStore?.invisibleExemplarDocuments);
        if (!chosen) {
          console.log("No hidden exemplars to reveal");
        } else {
          self.setExemplarVisibility(chosen.key, true);
        }
        self.drawingActions = 0;
      }
    }
  }))
  .actions((self) => ({
    /**
     * Take any needed actions after a user action, as represented by a log event.
     * @param logMessage
     */
    processLogMessage(logMessage: LogMessage) {
      let needsUpdate = false;
      // At the moment we are only looking at one type of event: adding an object in a Draw tile.
      if (logMessage.event === LogEventName[LogEventName.DRAWING_TOOL_CHANGE]) {
        const operation = logMessage.parameters?.operation;
        if (typeof operation === "string"
            && ["addObject", "addAndSelectObject", "duplicateObjects"].includes(operation)) {
          self.drawingActions ++;
          console.log("Graph actions noted:", self.drawingActions);
          needsUpdate = true;
        }
      }
      if (needsUpdate) {
        self.updateExemplars();
      }
    }
}));

export type ExemplarControllerModelType = typeof ExemplarControllerModel.Type;
