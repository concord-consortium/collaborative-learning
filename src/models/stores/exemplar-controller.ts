import { applySnapshot, types, onSnapshot } from "mobx-state-tree";
import { UserModelType } from "./user";
import { DB } from "../../lib/db";
import { safeJsonParse } from "../../utilities/js-utils";
import { LogEventMethod, LogEventName } from "../../lib/logger-types";
import { DocumentsModelType } from "./documents";


export const ExemplarControllerModel = types
  .model("ExemplarController", {
  })
  .volatile((self) => ({
    graphActions: 0,
    documentsStore: undefined as DocumentsModelType | undefined
  }))
  .actions((self) => ({
    async initialize(user: UserModelType, db: DB) {
      self.documentsStore = db.stores.documents;
      const path = db.firebase.getExemplarStatePath(user);
      const getRef = db.firebase.ref(path);
      const theData: string | undefined = (await getRef.once("value"))?.val();
      const asObj = safeJsonParse(theData);
      console.log("initializing ExemplarController; state=", asObj);
      if (asObj) {
        applySnapshot(self, asObj);
      }

      onSnapshot(self, (snapshot)=>{
        const snapshotStr = JSON.stringify(snapshot);
        const updateRef = db.firebase.ref(path);
        updateRef.set(snapshotStr);
      });
    },
    updateExemplars() {
      if (self.graphActions >= 3) {
        const invisible = self.documentsStore?.invisibleExemplarDocuments;

        if (!invisible || !invisible.length) {
          console.log("No hidden exemplars to reveal");
        } else {
          const random = invisible[0]; // TODO make random
          console.log("Revealing exemplar", random.key, "from", invisible.map(e=>e.key));
          self.documentsStore?.setExemplarVisible(random.key, true);
        }
        self.graphActions = 0;
      }
    }
  }))
  .actions((self) => ({
    recordLogEvent(date: number, event: LogEventName, parameters?: Record<string, unknown>, method?: LogEventMethod) {
      console.log("Examining log event", event, parameters);
      if (event === LogEventName.DRAWING_TOOL_CHANGE) {
        const operation = parameters?.operation;
        if (typeof operation === "string" && operation === "addAndSelectObject") {
          self.graphActions ++;
          self.updateExemplars();
        }
      }
    }
}));

export type ExemplarControllerModelType = typeof ExemplarControllerModel.Type;
