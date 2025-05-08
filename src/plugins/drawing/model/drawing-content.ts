import { types, Instance, SnapshotIn, getSnapshot, isStateTreeNode, detach, destroy} from "mobx-state-tree";
import { clone } from "lodash";
import stringify from "json-stringify-pretty-compact";

import { DefaultToolbarSettings, Point, ToolbarSettings, VectorType, endShapesForVectorType }
  from "./drawing-basic-types";
import { kDrawingStateVersion, kDrawingTileType } from "./drawing-types";
import { StampModel, StampModelType } from "./stamp";
import { DrawingObjectMSTUnion } from "../components/drawing-object-manager";
import { DrawingObjectSnapshotForAdd, DrawingObjectType,
  ObjectMap, ToolbarModalButton } from "../objects/drawing-object";
import { isImageObjectSnapshot } from "../objects/image";
import { LogEventName } from "../../../lib/logger-types";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { ITileExportOptions, IDefaultContentOptions } from "../../../models/tiles/tile-content-info";
import { TileMetadataModel } from "../../../models/tiles/tile-metadata";
import { tileContentAPIActions, tileContentAPIViews } from "../../../models/tiles/tile-model-hooks";
import { IClueTileObject } from "../../../models/annotations/clue-object";
import { GroupObjectSnapshotForAdd, GroupObjectType, isGroupObject } from "../objects/group";
import { NavigatableTileModel } from "../../../models/tiles/navigatable-tile-model";

export const DrawingToolMetadataModel = TileMetadataModel
  .named("DrawingToolMetadata");
export type DrawingToolMetadataModelType = Instance<typeof DrawingToolMetadataModel>;

export enum OpenPaletteValues {
  None = "none",
  Vector = "vector",
  StrokeColor = "stroke-color",
  FillColor = "fill-color",
  Stamp = "stamp",
}
export interface DrawingObjectMove {
  id: string,
  destination: {x: number, y: number}
}

export const DrawingContentModel = NavigatableTileModel
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
    currentStampIndex: types.maybe(types.number),
  })
  .volatile(self => ({
    metadata: undefined as DrawingToolMetadataModelType | undefined,
    selectedButton: "select",
    selection: [] as string[],
    openPallette: OpenPaletteValues.None as OpenPaletteValues,
  }))
  .views(self => ({
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
    // Return the first object found that has its origin at the given point; or undefined if none.
    objectAtLocation(pos: Point) {
      return self.objects.find((obj) => {
        return (obj.x === pos.x && obj.y === pos.y);
      });
    },
    /** Return a bounding box that contains all objects in the content */
    get objectsBoundingBox() {
      if (self.objects.length === 0) return { nw: { x: 0, y: 0 }, se: { x: 0, y: 0 } };

      const firstBB = self.objects[0].boundingBox;
      const nw = { x: firstBB.nw.x, y: firstBB.nw.y };
      const se = { x: firstBB.se.x, y: firstBB.se.y };

      self.objects.forEach((obj) => {
        const bb = obj.boundingBox;
        if (bb.nw.x < nw.x) nw.x = bb.nw.x;
        if (bb.nw.y < nw.y) nw.y = bb.nw.y;
        if (bb.se.x > se.x) se.x = bb.se.x;
        if (bb.se.y > se.y) se.y = bb.se.y;
      });

      return { nw, se };
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
  .views(self => tileContentAPIViews({
    get annotatableObjects(): IClueTileObject[] {
      return self.objects.map(object => ({
        objectId: object.id,
        objectType: object.type,
      }));
    },
  }))
  .actions(self => tileContentAPIActions({
    doPostCreate(metadata) {
      self.metadata = metadata as DrawingToolMetadataModelType;
    },
    onTileAction(call) {
      const tileId = self.metadata?.id ?? "";
      const {name: operation, ...change} = call;
      // Ignore actions that don't need to be logged
      const ignoredActions = ["afterAttach", "afterCreate", "reset",
        "setDisabledFeatures", "setDragPosition", "setDragBounds",
        "setSelectedButton", "setSelectedIds", "setOpenPalette", "setEditing"];
      if (ignoredActions.includes(operation)) return;

      logTileChangeEvent(LogEventName.DRAWING_TOOL_CHANGE, { operation, change, tileId });
    }
  }))
  .actions(self => ({
    setSelectedIds(selection: string[]) {
      self.selection = [...selection];
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

    setOpenPalette(pallette: OpenPaletteValues) {
      self.openPallette = pallette;
    },

    addObject(object: DrawingObjectSnapshotForAdd, addAtBack=false) {
      // The reason only snapshots are allowed is so the logged action
      // includes the snapshot in the `call` that is passed to `onAction`.
      // If an instance is passed instead of a snapshot, then MST will just
      // log something like:
      // `{ $MST_UNSERIALIZABLE: true, type: "someType" }`.
      // More details can be found here: https://mobx-state-tree.js.org/API/#onaction
      if (isStateTreeNode(object as any)) {
        throw new Error("addObject requires a snapshot");
      }
      if (addAtBack) {
        self.objects.unshift(object);
        return self.objects[0];
      } else {
        self.objects.push(object);
        return self.objects[self.objects.length-1];
      }
    },

    moveObjectsOutOfGroup(group: GroupObjectType): string[] {
      const ids: string[] = [];
      group.objects.forEach((member) => {
        ids.push(member.id);
        self.objects.push(detach(member));
      });
      return ids;
    },

    // Moves one object in Z-order so that it will be in the stacking order
    // position currently occupied by the other object.
    // Eg starting with [A B C D E]
    // changeZOrder(A, C) --> [B C A D E]
    // changeZOrder(E, C) --> [A B E C D]
    changeZOrder(moveObjectId: string, replaceObjectId: string) {
      const obj = self.objectMap[moveObjectId];
      const dest = self.objectMap[replaceObjectId];
      if (obj && dest) {
        const destPosition = self.objects.indexOf(dest);
        const detached = detach(obj);
        self.objects.splice(destPosition, 0, detached);
      }
    }

  }))
  .actions(self => ({
    /* Add a single object (identified by its id) to the selection. */
    selectId(id: string) {
      if (self.objectMap[id] && !self.isIdSelected(id)) {
        // Just doing self.selection.push does not notify observers - not sure why.
        const selection = self.selection;
        selection.push(id);
        self.setSelectedIds(selection);
      }
    },

    /* Remove a single object (identified by its id) from the selection */
    unselectId(id: string) {
      const index = self.selection.indexOf(id);
      if (index >= 0) {
        self.selection.splice(index, 1);
      } else {
        console.error('Failed to remove id ', id, ' from selection: [', self.selection, ']');
      }
    },


    // Destroy any groups in the given list, moving their members to the top level.
    // The ungrouped members are selected, along with any non-group objects in the initial set.
    ungroupGroups(groupIds: string[]) {
      const allIds = groupIds.reduce((objectIds, groupId) => {
          const object = self.objectMap[groupId];
          if (object && isGroupObject(object)) {
              const ids = self.moveObjectsOutOfGroup(object);
              destroy(object);
              return [...objectIds, ...ids];
          } else {
            if (object) objectIds.push(object.id);
            return objectIds;
          }
      }, [] as string[]);
      self.selection = allIds;
    },

    // Adds a new object and selects it, activating the select tool.
    addAndSelectObject(drawingObject: DrawingObjectSnapshotForAdd, addAtBack=false) {
      const obj = self.addObject(drawingObject, addAtBack);
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
            if ('setStroke' in object && typeof object.setStroke === 'function') {
              object.setStroke(stroke);
            }
          });
        },
        setFill(fill: string, ids: string[]) {
          self.fill = fill;
          forEachObjectId(ids, object => {
            if ('setFill' in object && typeof object.setFill === 'function') {
              object.setFill(fill);
            }
          });
        },
        setStrokeDashArray(strokeDashArray: string, ids: string[]) {
          self.strokeDashArray = strokeDashArray;
          forEachObjectId(ids, object => {
            if ('setStrokeDashArray' in object && typeof object.setStrokeDashArray === 'function') {
              object.setStrokeDashArray(strokeDashArray);
            }
          });
        },
        setStrokeWidth(strokeWidth: number, ids: string[]) {
          self.strokeWidth = strokeWidth;
          forEachObjectId(ids, object => {
            if ('setStrokeWidth' in object && typeof object.setStrokeWidth === 'function') {
              object.setStrokeWidth(strokeWidth);
            }
          });
        },
        setVectorType(vectorType: VectorType, ids: string[]) {
          self.vectorType = vectorType;
          forEachObjectId(ids, object => {
            if ('setEndShapes' in object && typeof object.setEndShapes === 'function') {
              object.setEndShapes(...endShapesForVectorType(vectorType));
            }
          });
        },
        flipHorizontal(ids: string[]) {
          forEachObjectId(ids, object => {
            object.hFlip = !object.hFlip;
          });
        },
        flipVertical(ids: string[]) {
          forEachObjectId(ids, object => {
            object.vFlip = !object.vFlip;
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
              let newObject: DrawingObjectType;
              const snap = getSnapshot(object);
              if (isGroupObject(object)) {
                const newGroup = {
                  type: "group",
                  x: 0,
                  y: 0,
                  objects: getSnapshot(object.objects).map((s) => {
                    const {id, ...params} = s;
                    params.x += 10;
                    params.y += 10;
                    return params;
                  })
                };
                newObject = self.addObject(newGroup);
              } else {
                const {id, ...newParams} = snap; // remove existing ID
                newParams.x = snap.x + 10;     // offset by 10 pixels so it is not hidden
                newParams.y = snap.y + 10;
                newObject = self.addObject(newParams);
              }
              newIds.push(newObject.id);
            }
          });
          self.setSelectedIds(newIds);
        },

        createGroup(objectIds: string[]) {
          const props: GroupObjectSnapshotForAdd = {
            type: "group",
            x: 0,
            y: 0
          };
          const group = self.addAndSelectObject(props) as GroupObjectType;
          let hasVisibleMember = false;
          forEachObjectId(objectIds, (obj) => {
            if (isGroupObject(obj)) {
              // Adding a group to a group:
              // Transfer old group's members into new group; delete old group.
              obj.objects.forEach((member) => {
                group.objects.push(detach(member));
                if (member.visible) hasVisibleMember = true;
              });
              destroy(obj);
            } else {
              // Adding a regular object - just move node.
              group.objects.push(detach(obj));
              if (obj.visible) hasVisibleMember = true;
            }
          });
          group.visible = hasVisibleMember;
          group.computeExtents();
        },
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
