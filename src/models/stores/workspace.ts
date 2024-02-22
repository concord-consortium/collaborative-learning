import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { DocumentModelType } from "../document/document";
import { GroupVirtualDocument } from "../document/group-virtual-document";
import { logDocumentEvent } from "../document/log-document-event";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";

export const ProblemWorkspace = "problem";
export const LearningLogWorkspace = "learningLog";

export const WorkspaceTypes = [ProblemWorkspace, LearningLogWorkspace] as const;
export const WorkspaceTypeEnum = types.enumeration("type", [...WorkspaceTypes]);
export type WorkspaceType = typeof WorkspaceTypeEnum.Type;

export const WorkspaceModes = ["1-up", "4-up"] as const;
export const WorkspaceModeEnum = types.enumeration("mode", [...WorkspaceModes]);
export type WorkspaceMode = typeof WorkspaceModeEnum.Type;

export const WorkspaceModel = types
  .model("Workspace", {
    type: WorkspaceTypeEnum,
    mode: WorkspaceModeEnum,
    primaryDocumentKey: types.maybe(types.string),
    comparisonDocumentKey: types.maybe(types.string),
    comparisonVisible: false,
    hidePrimaryForCompare: false
  })
  .actions((self) => {
    const setPrimaryDocument = (document?: DocumentModelType) => {
      self.primaryDocumentKey = document && document.key;
      if (document) {
        logDocumentEvent(LogEventName.VIEW_SHOW_DOCUMENT, { document });
      }
    };
    const setComparisonDocument = (document?: DocumentModelType | GroupVirtualDocument) => {
      self.comparisonDocumentKey = document && document.key;
      if (document && !(document instanceof GroupVirtualDocument)) {
        logDocumentEvent(LogEventName.VIEW_SHOW_COMPARISON_DOCUMENT, { document });
      }
    };

    return {
      setPrimaryDocument,
      setComparisonDocument,

      toggleMode(override?: WorkspaceMode) {
        self.mode = typeof override === "undefined"
          ? (self.mode === "1-up" ? "4-up" : "1-up")
          : override;

        const logEvent = self.mode === "1-up"
          ? LogEventName.VIEW_ENTER_ONE_UP
          : LogEventName.VIEW_ENTER_FOUR_UP;
        Logger.log(logEvent);
      },

      setAvailableDocument(document?: DocumentModelType) {
        if (self.comparisonVisible) {
          setComparisonDocument(document);
        }
        else {
          setPrimaryDocument(document);
        }
      },

      toggleComparisonVisible({override, muteLog = false, hidePrimary = false}:
          {override?: boolean; muteLog?: boolean, hidePrimary?: boolean} = {}) {
        const visible = typeof override !== "undefined" ? override : !self.comparisonVisible;
        self.comparisonVisible = visible;
        self.hidePrimaryForCompare = hidePrimary;
        if (!visible) {
          self.comparisonDocumentKey = undefined;
        }

        if (!muteLog) {
          const logEvent = self.comparisonVisible
            ? LogEventName.VIEW_SHOW_COMPARISON_PANEL
            : LogEventName.VIEW_HIDE_COMPARISON_PANEL;
          Logger.log(logEvent);
        }
      }

    };
  })
  .actions(self => ({
    viewComparisonDocument(document?: DocumentModelType) {
      if (!self.comparisonVisible) {
        self.toggleComparisonVisible({ override: true });
      }
      self.setComparisonDocument(document);
    }
  }));

export interface WorkspaceModelType extends Instance<typeof WorkspaceModel> {}
export interface WorkspaceModelSnapshot extends SnapshotIn<typeof WorkspaceModel> {}

export function isWorkspaceModelSnapshot(snap?: any): snap is WorkspaceModelSnapshot {
  return snap && typeof snap === "object" &&
          WorkspaceTypes.includes(snap.type) &&
          WorkspaceModes.includes(snap.mode);
}
