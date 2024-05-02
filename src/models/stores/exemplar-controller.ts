import { applySnapshot, types, onSnapshot, detach } from "mobx-state-tree";
import _ from "lodash";
import { UserModelType } from "./user";
import { DB } from "../../lib/db";
import { safeJsonParse } from "../../utilities/js-utils";
import { LogEventName } from "../../lib/logger-types";
import { DocumentsModelType } from "./documents";
import { Logger, LogMessage } from "../../lib/logger";
import { logExemplarDocumentEvent } from "../document/log-exemplar-document-event";
import { allExemplarControllerRules } from "./exemplar-controller-rules";
import { kDrawingTileType } from "../../plugins/drawing/model/drawing-types";
import { kTextTileType } from "../tiles/text/text-content";
import { countWords } from "../../utilities/string-utils";

/**
 * Information that the exemplar controller stores about specific tiles.
 * At the moment this includes two numbers representing the level of activity, and the
 * length of text in the tile. So far we are only tracking Text and Drawing tiles.
 */
export const InProgressTileModel = types
  .model("InProgressTile", {
    id: types.identifier,
    type: types.string,
    activityLevel: 0,
    wordCount: 0
  });

// The database structure of this object is expected to change frequently as we develop
// this feature, so keep an explicit version number to make migrations easier.
const kExemplarControllerStateVersion = "1";

export const BaseExemplarControllerModel = types
  .model("BaseExemplarController", {
    version: types.optional(types.literal(kExemplarControllerStateVersion), kExemplarControllerStateVersion),
    // Store separate maps of tiles that have already been "used" to open up
    // a new exemplar, and those that have not.
    completeTiles: types.map(InProgressTileModel),
    inProgressTiles: types.map(InProgressTileModel)
  })
  .volatile((self) => ({
    documentsStore: undefined as DocumentsModelType | undefined,
    db: undefined as DB|undefined,
    firebasePath: undefined as string|undefined
  }))
  .actions((self) => ({
    /**
     * Writes to the database to indicate whether the current user has access to the given exemplar.
     */
    setExemplarVisibility(key: string, isVisible: boolean) {
      if (self.db) {
        self.db.firebase.ref(self.firebasePath).child(`${key}/visible`).set(isVisible);
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
    showRandomExemplar() {
      const chosen = _.sample(self.documentsStore?.invisibleExemplarDocuments);
      if (chosen) {
        self.setExemplarVisibility(chosen.key, true);
      }
      return chosen;
    },
    /**
     * Moves our records of the tiles from the 'inProgress' map to the 'complete' map.
     * @param keys
     */
    markTilesComplete(keys: string[]) {
      for (const key of keys) {
        const tile = self.inProgressTiles.get(key);
        if (tile) {
          detach(tile);
          self.completeTiles.put(tile);
        }
      }
    }
  }));

export const ExemplarControllerModel = BaseExemplarControllerModel
  .actions((self) => ({
    /**
     * Makes any appropriate changes to exemplars based on the current state.
     * This should be called after any state changes that may require action.
     */
    runAllRules() {
      for (const rule of allExemplarControllerRules) {
        const result = rule.test(self);
        if (result) {
          const chosen = self.showRandomExemplar();
          rule.reset(self, result);
          if (chosen) {
            logExemplarDocumentEvent(LogEventName.EXEMPLAR_VISIBILITY_UPDATE,
              {
                document: chosen,
                visibleToUser: true,
                changeSource: "rule",
                rule: rule.name
              });
          }
        }
      }
    },
    getOrCreateInProgressTile(id: string, type: string) {
      let tile = self.inProgressTiles.get(id);
      if (!tile) {
        tile = self.inProgressTiles.put({ id, type });
      }
      return tile;
    }
  }))
  .actions((self) => ({
    /**
     * Take any needed actions after a user action, as represented by a log event.
     * @param logMessage
     */
    processLogMessage(logMessage: LogMessage) {
      let needsUpdate = false;

      // Text tiles
      if (logMessage.event === LogEventName[LogEventName.TEXT_TOOL_CHANGE]) {
        // For text tiles, track the current number of words in the tile.
        const tileId = logMessage.parameters.tileId;
        if (self.completeTiles.has(tileId)) {
          // Don't need to update status on tiles that are 'completed'
          return;
        }
        const operation = logMessage.parameters?.operation;
        if (_.isString(operation) && operation === "update") {
          const tile = self.getOrCreateInProgressTile(tileId, kTextTileType);
          const wordCount = logMessage.parameters?.wordCount;
          if (wordCount && wordCount !== tile.wordCount) {
            tile.wordCount = wordCount;
            needsUpdate = true;
          }
        }
      }

      if (logMessage.event === LogEventName[LogEventName.DRAWING_TOOL_CHANGE]) {
        // For drawing tile, "activityLevel" counts the number of objects that the user has added.
        // WordCount tracks the content of the longest 'text' object in the drawing.
        const tileId = logMessage.parameters.tileId;
        if (self.completeTiles.has(tileId)) {
          return;
        }
        const operation = logMessage.parameters?.operation;
        if (_.isString(operation)
            && ["setText", "addObject", "addAndSelectObject", "duplicateObjects"].includes(operation)) {
          const tile = self.getOrCreateInProgressTile(tileId, kDrawingTileType);

          if (operation === "setText") {
            const args = logMessage.parameters?.args;
            if (args && _.isArray(args) && args.length > 0) {
              const words = countWords(args[0]);
              if (words > tile.wordCount) {
                tile.wordCount = words;
                needsUpdate = true;
              }
            }
          } else {
            // Add or duplicate object operation
            tile.activityLevel ++;
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        self.runAllRules();
      }
    }
  }))
  .actions(self => ({
    async initialize(user: UserModelType, db: DB) {
      self.db = db;
      self.documentsStore = db.stores.documents;
      self.firebasePath = db.firebase.getUserExemplarsPath(user);
      const statePath = db.firebase.getExemplarStatePath(user);
      const stateRef = db.firebase.ref(statePath);
      const stateVal = (await stateRef.once("value"))?.val();
      const state = safeJsonParse(stateVal);
      if (state) {
        applySnapshot(self, state);
      }
      Logger.Instance.registerLogListener(self.processLogMessage);

      onSnapshot(self, (snapshot)=>{
        const snapshotStr = JSON.stringify(snapshot);
        const updateRef = db.firebase.ref(statePath);
        updateRef.set(snapshotStr);
      });
    }
  }));

export type BaseExemplarControllerModelType = typeof BaseExemplarControllerModel.Type;

export type ExemplarControllerModelType = typeof ExemplarControllerModel.Type;
