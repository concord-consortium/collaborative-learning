import { types, Instance, SnapshotIn, getSnapshot, isStateTreeNode, detach} from "mobx-state-tree";
import { clone } from "lodash";
import stringify from "json-stringify-pretty-compact";

import { DefaultToolbarSettings, ToolbarSettings, VectorType, endShapesForVectorType } from "./drawing-basic-types";
import { kDrawingStateVersion, kDrawingTileType } from "./drawing-types";
import { StampModel, StampModelType } from "./stamp";
import { DrawingObjectMSTUnion } from "../components/drawing-object-manager";
import { DrawingObjectSnapshotForAdd, DrawingObjectType, isFilledObject,
  isStrokedObject, ObjectMap, ToolbarModalButton } from "../objects/drawing-object";
import { ImageObjectType, isImageObjectSnapshot } from "../objects/image";
import { isVectorObject } from "../objects/vector";
import { LogEventName } from "../../../lib/logger-types";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { ITileExportOptions, IDefaultContentOptions } from "../../../models/tiles/tile-content-info";
import { TileMetadataModel } from "../../../models/tiles/tile-metadata";
import { getTileIdFromContent } from "../../../models/tiles/tile-model";
import { tileModelHooks } from "../../../models/tiles/tile-model-hooks";
import { GroupObjectType, isGroupObject } from "../objects/group";

export const DrawingToolMetadataModel = TileMetadataModel
  .named("DrawingToolMetadata");
export type DrawingToolMetadataModelType = Instance<typeof DrawingToolMetadataModel>;

export interface DrawingObjectMove {
  id: string,
  destination: {x: number, y: number}
}

export const DrawingContentModel = TileContentModel
  .named("DrawingTool")
  .props({
    type: types.optional(types.literal(kDrawingTileType), kDrawingTileType),
    version: types.optional(types.literal(kDrawingStateVersion), kDrawingStateVersion),
    objects: types.array(DrawingObjectMSTUnion),
    stroke: DefaultToolbarSettings.stroke,
    fill: DefaultToolbarSettings.fill,
    strokeDashArray: DefaultToolbarSettings.strokeDashArray,
    strokeWidth: DefaultToolbarSettings.strokeWidth,
    stamps: types.array(StampModel),
    vectorType: types.maybe(types.enumeration<VectorType>("VectorType", Object.values(VectorType))),
    // is type.maybe to avoid need for migration
    currentStampIndex: types.maybe(types.number)
  })
  .volatile(self => ({
    metadata: undefined as DrawingToolMetadataModelType | undefined,
    selectedButton: "select",
    selection: [] as string[]
  }))
  .views(self => ({
    get annotatableObjects() {
      const tileId = getTileIdFromContent(self) ?? "";
      return self.objects.map(object => ({
        objectId: object.id,
        objectType: object.type,
        tileId 
      }));
    },
    get objectMap() {
      // TODO this will rebuild the map when any of the objects change
      // We could handle this more efficiently
      return self.objects.reduce((map, obj) => {
        map[obj.id] = obj;
        if (isGroupObject(obj)) {
          obj.objects.forEach((member) => {
            map[member.id] = member;
          });          
        }
        return map;
      }, {} as ObjectMap);
    },
    get isUserResizable() {
      return true;
    },
    isSelectedButton(button: ToolbarModalButton) {
      return button === self.selectedButton;
    },

    get hasSelectedObjects() {
      return self.selection.length > 0;
    },
    isIdSelected(id: string) {
      return self.selection.includes(id);
    },
    get currentStamp() {
      const currentStampIndex = self.currentStampIndex || 0;
      return currentStampIndex < self.stamps.length
              ? self.stamps[currentStampIndex]
              : null;
    },
    get toolbarSettings(): ToolbarSettings {
      const { stroke, fill, strokeDashArray, strokeWidth, vectorType } = self;
      return { stroke, fill, strokeDashArray, strokeWidth, vectorType };
    },
    exportJson(options?: ITileExportOptions) {
      // Translate image urls if necessary
      const {type, objects: originalObjects} = getSnapshot(self);
      const objects = originalObjects.map(object => {
        if (isImageObjectSnapshot(object) && options?.transformImageUrl) {
          if (object.filename) {
            const newImage = clone(object);
            newImage.url = options.transformImageUrl(object.url, object.filename);
            newImage.filename = undefined;
            return newImage;
          }
        }
        return object;
      });

      // json-stringify-pretty-compact is used, so the exported content is more
      // compact. It results in something close to what we used to get when the
      // export was created using a string builder.
      return stringify({type, objects}, {maxLength: 200});
    }
  }))
  .views(self => ({
    getSelectedObjects():DrawingObjectType[] {
      return self.selection.map((id) => self.objectMap[id]).filter((x)=>!!x) as DrawingObjectType[];
    }
  }))
  .actions(self => tileModelHooks({
    doPostCreate(metadata) {
      self.metadata = metadata as DrawingToolMetadataModelType;
    },
    onTileAction(call) {
      const tileId = self.metadata?.id ?? "";
      const {name: operation, ...change} = call;
      // Ignore actions that don't need to be logged
      if (["setDisabledFeatures", "setDragPosition", "setDragBounds", "setSelectedButton"].includes(operation)) return;

      logTileChangeEvent(LogEventName.DRAWING_TOOL_CHANGE, { operation, change, tileId });
    }
  }))
  .actions(self => ({
    setSelectedIds(selection: string[]) {
      self.selection = [...selection];
    },

    unselectId(id: string) {
      const index = self.selection.indexOf(id);
      if (index >= 0) {
        self.selection.splice(index, 1);
      } else {
        console.error('Failed to remove id ', id, ' from selection: [', self.selection, ']');
      }
    },

    setSelectedButton(button: ToolbarModalButton) {
      if (self.selectedButton !== button) {
        self.selectedButton = button;
        // clear selection on tool mode change
        self.selection = [];
      }
    },

    setSelectedStamp(stampIndex: number) {
      self.currentStampIndex = stampIndex;
    },

    addObject(object: DrawingObjectSnapshotForAdd) {
      // The reason only snapshots are allowed is so the logged action
      // includes the snapshot in the `call` that is passed to `onAction`.
      // If an instance is passed instead of a snapshot, then MST will just
      // log something like:
      // `{ $MST_UNSERIALIZABLE: true, type: "someType" }`.
      // More details can be found here: https://mobx-state-tree.js.org/API/#onaction
      if (isStateTreeNode(object as any)) {
        throw new Error("addObject requires a snapshot");
      }

      self.objects.push(object);
      return self.objects[self.objects.length-1];
    },

    moveObjectsIntoGroup(group: GroupObjectType, objectIds: string[]) {
      objectIds.forEach((id) => {
        const obj = self.objectMap[id];
        if (obj) {
          group.objects.push(detach(obj));
        }
      });
    }
  }))
  .actions(self => ({
    // Adds a new object and selects it, activating the select tool.
    addAndSelectObject(drawingObject: DrawingObjectSnapshotForAdd) {
      const obj = self.addObject(drawingObject);
      self.setSelectedButton('select');
      self.setSelectedIds([obj.id]);
      return obj;
    }

  }))
  .extend(self => {

    function forEachObjectId(ids: string[], func: (object: DrawingObjectType, id: string) => void) {
      if (ids.length === 0) return;

      const { objectMap } = self;
      ids.forEach(id => {
        const object = objectMap[id];
        if (object) {
          func(object, id);
        }
      });
    }

    return {
      actions: {
        setStroke(stroke: string, ids: string[]) {
          self.stroke = stroke;
          forEachObjectId(ids, object => {
            if(isStrokedObject(object)) {
              object.setStroke(stroke);
            }
          });
        },
        setFill(fill: string, ids: string[]) {
          self.fill = fill;
          forEachObjectId(ids, object => {
            if (isFilledObject(object)) {
              object.setFill(fill);
            }
          });
        },
        setStrokeDashArray(strokeDashArray: string, ids: string[]) {
          self.strokeDashArray = strokeDashArray;
          forEachObjectId(ids, object => {
            if(isStrokedObject(object)) {
              object.setStrokeDashArray(strokeDashArray);
            }
          });
        },
        setStrokeWidth(strokeWidth: number, ids: string[]) {
          self.strokeWidth = strokeWidth;
          forEachObjectId(ids, object => {
            if(isStrokedObject(object)) {
              object.setStrokeWidth(strokeWidth);
            }
          });
        },
        setVectorType(vectorType: VectorType, ids: string[]) {
          self.vectorType = vectorType;
          forEachObjectId(ids, object => {
            if (isVectorObject(object)) {
              object.setEndShapes(...endShapesForVectorType(vectorType));
            }
          });
        },

        deleteObjects(ids: string[]) {
          forEachObjectId(ids, (object, id) => {
            if (object) {
              self.objects.remove(object);
              self.unselectId(id);
            }
          });
        },

        duplicateObjects(ids: string[]) {
          const newIds: string[] = [];
          forEachObjectId(ids, (object) => {
            if (object) {
              const snap = getSnapshot(object);
              const {id, ...newParams} = snap; // remove existing ID
              newParams.x = snap.x + 10;       // offset by 10 pixels so it is not hidden
              newParams.y = snap.y + 10;
              const newObject = self.addObject(newParams);
              newIds.push(newObject.id);
            }
          });
          self.setSelectedIds(newIds);
        },

        moveObjects(moves: DrawingObjectMove[]) {
          moves.forEach(move => {
            const object = self.objectMap[move.id];
            object?.setPosition(move.destination.x, move.destination.y);
          });
        },

        updateImageUrl(oldUrl: string, newUrl: string) {
          if (!oldUrl || !newUrl || (oldUrl === newUrl)) return;
          // Modify all images with this url
          self.objects.forEach(object => {
            if (object.type !== "image") return;
            const image = object as ImageObjectType;
            if (image.url === oldUrl) {
              image.setUrl(newUrl);
            }
          });
        }
      }
    };
  })
  .actions(self => ({
    // sets the model to how we want it to appear when a user first opens a document
    reset() {
      self.setSelectedButton("select");
    },
    updateAfterSharedModelChanges() {
      // console.warn("TODO: need to implement yet");
    }
  }));

export type DrawingContentModelType = Instance<typeof DrawingContentModel>;
export type DrawingContentModelSnapshot = SnapshotIn<typeof DrawingContentModel>;

// The migrator sometimes modifies the content model it is trying to migrate.
// This weird migrator behavior is demonstrated here: src/models/mst.test.ts
//
// The create of the content model goes through the migrator when this happens.
// In that case if the snapshot passed to create doesn't have a version
// the migrator might mess up the snapshot.
// Because of behavior, this createDrawingContent method should be used instead
// of directly calling DrawingContentModel.create
export function createDrawingContent(snapshot?: SnapshotIn<typeof DrawingContentModel>) {
  return DrawingContentModel.create({
    version: kDrawingStateVersion,
    ...snapshot
  });
}

export function defaultDrawingContent(options?: IDefaultContentOptions) {
  let stamps: StampModelType[] = [];
  if (options?.appConfig?.stamps) {
    stamps = options.appConfig.stamps;
  }
  return createDrawingContent({ stamps });
}
