import { types, Instance, SnapshotIn, getSnapshot, onAction, isStateTreeNode} from "mobx-state-tree";
import { clone } from "lodash";
import stringify from "json-stringify-pretty-compact";
import { StampModel, StampModelType } from "./stamp";
import { ITileExportOptions, IDefaultContentOptions } from "../../../models/tools/tool-content-info";
import { ToolMetadataModel, ToolContentModel, toolContentModelHooks } from "../../../models/tools/tool-types";
import { kDrawingStateVersion, kDrawingToolID } from "./drawing-types";
import { ImageObjectType, isImageObjectSnapshot } from "../objects/image";
import { DefaultToolbarSettings, ToolbarSettings } from "./drawing-basic-types";
import { DrawingObjectMSTUnion } from "../components/drawing-object-manager";
import { DrawingObjectSnapshotForAdd, DrawingObjectType, isFilledObject, 
  isStrokedObject, ToolbarModalButton } from "../objects/drawing-object";

// interface LoggedEventProperties {
//   properties?: string[];
// }
// interface DrawingToolLoggedCreateEvent extends Partial<DrawingToolCreateChange>, LoggedEventProperties {
// }
// interface DrawingToolLoggedMoveEvent extends Partial<DrawingToolMoveChange>, LoggedEventProperties {
// }
// interface DrawingToolLoggedUpdateEvent extends Partial<DrawingToolUpdateChange>, LoggedEventProperties {
// }
// interface DrawingToolLoggedDeleteEvent extends Partial<DrawingToolDeleteChange>, LoggedEventProperties {
// }
// type DrawingToolChangeLoggedEvent = DrawingToolLoggedCreateEvent | DrawingToolLoggedMoveEvent |
//                                       DrawingToolLoggedUpdateEvent | DrawingToolLoggedDeleteEvent;

// track selection in metadata object so it is not saved to firebase but
// also is preserved across document/content reloads
export const DrawingToolMetadataModel = ToolMetadataModel
  .named("DrawingToolMetadata")
  .props({
    selectedButton: "select",
    selection: types.array(types.string)
  })
  .actions(self => ({
    setSelectedButton(button: ToolbarModalButton) {
      if (self.selectedButton !== button) {
        self.selectedButton = button;
        // clear selection on tool mode change
        self.selection.clear();
      }
    },
    setSelection(selection: string[]) {
      self.selection.replace(selection);
    },
    unselectId(id: string) {
      self.selection.remove(id);
    }
  }));
export type DrawingToolMetadataModelType = Instance<typeof DrawingToolMetadataModel>;

interface ObjectMap {
  [key: string]: DrawingObjectType|null;
}

export interface DrawingObjectMove {
  id: string, 
  destination: {x: number, y: number}
}

export const DrawingContentModel = ToolContentModel
  .named("DrawingTool")
  .props({
    type: types.optional(types.literal(kDrawingToolID), kDrawingToolID),
    version: types.optional(types.literal(kDrawingStateVersion), kDrawingStateVersion),
    objects: types.array(DrawingObjectMSTUnion),
    stroke: DefaultToolbarSettings.stroke,
    fill: DefaultToolbarSettings.fill,
    strokeDashArray: DefaultToolbarSettings.strokeDashArray,
    strokeWidth: DefaultToolbarSettings.strokeWidth,
    stamps: types.array(StampModel),
    // is type.maybe to avoid need for migration
    currentStampIndex: types.maybe(types.number)
  })
  .volatile(self => ({
    metadata: undefined as DrawingToolMetadataModelType | undefined
  }))
  .views(self => ({
    get objectMap() {
      // TODO this will rebuild the map when any of the objects change
      // We could handle this more efficiently
      return self.objects.reduce((map, obj) => {
        map[obj.id] = obj;
        return map;
      }, {} as ObjectMap);
    },
    get isUserResizable() {
      return true;
    },
    isSelectedButton(button: ToolbarModalButton) {
      return button === self.metadata?.selectedButton;
    },
    get selectedButton() {
      return self.metadata ? self.metadata.selectedButton : "select";
    },
    get hasSelectedObjects() {
      return self.metadata ? self.metadata.selection.length > 0 : false;
    },
    get selectedIds() {
      return self.metadata ? getSnapshot(self.metadata.selection) : [];
    },
    get currentStamp() {
      const currentStampIndex = self.currentStampIndex || 0;
      return currentStampIndex < self.stamps.length
              ? self.stamps[currentStampIndex]
              : null;
    },
    get toolbarSettings(): ToolbarSettings {
      const { stroke, fill, strokeDashArray, strokeWidth } = self;
      return { stroke, fill, strokeDashArray, strokeWidth };
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
  .actions(self => toolContentModelHooks({
    doPostCreate(metadata) {
      self.metadata = metadata as DrawingToolMetadataModelType;
    },
    onTileAction(call) {
      console.log("Action was called", call);
    }
  }))
  .extend(self => {

    // FIXME: need to deal with logging the events
    // function applyChange(change: DrawingToolChange) {
    //   self.changes.push(JSON.stringify(change));

    //   let loggedChangeProps = {...change} as DrawingToolChangeLoggedEvent;
    //   delete loggedChangeProps.data;
    //   if (!Array.isArray(change.data)) {
    //     // flatten change.properties
    //     loggedChangeProps = {
    //       ...loggedChangeProps,
    //       ...change.data
    //     };
    //   } else {
    //     // or clean up MST array
    //     loggedChangeProps.properties = Array.from(change.data as string[]);
    //   }
    //   delete loggedChangeProps.action;
    //   Logger.logToolChange(LogEventName.DRAWING_TOOL_CHANGE, change.action,
    //     loggedChangeProps, self.metadata?.id ?? "");
    // }

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

    // Keeping this around to help when adding back logging
    // function updateSelectedObjects(prop: string, newValue: string|number) {
    //   if (self.metadata.selection.length > 0) {
    //     const updateChange: DrawingToolChange = {
    //       action: "update",
    //       data: {
    //         ids: self.metadata.selection,
    //         update: {
    //           prop,
    //           newValue
    //         }
    //       }
    //     };
    //     applyChange(updateChange);
    //   }
    // }

    return {
      actions: {
        addObject(object: DrawingObjectSnapshotForAdd) {
          if (isStateTreeNode(object as any)) {
            throw new Error("addObject requires a snapshot");
          }
  
          self.objects.push(object);
        },

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

        setSelectedButton(button: ToolbarModalButton) {
          self.metadata?.setSelectedButton(button);
        },

        setSelection(ids: string[]) {
          self.metadata?.setSelection(ids);
        },

        setSelectedStamp(stampIndex: number) {
          self.currentStampIndex = stampIndex;
        },

        deleteObjects(ids: string[]) {
          forEachObjectId(ids, (object, id) => {
            if (object) {
              self.objects.remove(object);
              self.metadata?.unselectId(id);
            }
          });
        },

        moveObjects(moves: DrawingObjectMove[]) {
          moves.forEach(move => {
            const object = self.objectMap[move.id];
            object?.setPosition(move.destination.x, move.destination.y);
          });
        },

        // sets the model to how we want it to appear when a user first opens a document
        reset() {
          self.metadata?.setSelectedButton("select");
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
    updateAfterSharedModelChanges() {
      console.warn("TODO: need to implement yet");
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

