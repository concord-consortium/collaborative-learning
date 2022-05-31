import { types, Instance } from "mobx-state-tree";
import { exportDrawingTileSpec } from "./drawing-export";
import { importDrawingTileSpec, isDrawingTileImportSpec } from "./drawing-import";
import { DrawingObjectDataType } from "./drawing-objects";
import { StampModel, StampModelType } from "./stamp";
import { ITileExportOptions, IDefaultContentOptions } from "../../../models/tools/tool-content-info";
import { ToolMetadataModel, ToolContentModel } from "../../../models/tools/tool-types";
import { safeJsonParse } from "../../../utilities/js-utils";
import { Logger, LogEventName } from "../../../lib/logger";
import {
  DefaultToolbarSettings, DrawingToolChange, DrawingToolCreateChange, DrawingToolDeleteChange, DrawingToolMoveChange,
  DrawingToolUpdate, DrawingToolUpdateChange, kDrawingToolID, ToolbarModalButton, ToolbarSettings
} from "./drawing-types";


export const computeStrokeDashArray = (type?: string, strokeWidth?: string|number) => {
  const dotted = isFinite(Number(strokeWidth)) ? Number(strokeWidth) : 0;
  const dashed = dotted * 3;
  switch (type) {
    case "dotted":
      return `${dotted},${dotted}`;
    case "dashed":
      return `${dashed},${dashed}`;
    default:
      return "";
  }
};

interface LoggedEventProperties {
  properties?: string[];
}
interface DrawingToolLoggedCreateEvent extends Partial<DrawingToolCreateChange>, LoggedEventProperties {
}
interface DrawingToolLoggedMoveEvent extends Partial<DrawingToolMoveChange>, LoggedEventProperties {
}
interface DrawingToolLoggedUpdateEvent extends Partial<DrawingToolUpdateChange>, LoggedEventProperties {
}
interface DrawingToolLoggedDeleteEvent extends Partial<DrawingToolDeleteChange>, LoggedEventProperties {
}
type DrawingToolChangeLoggedEvent = DrawingToolLoggedCreateEvent | DrawingToolLoggedMoveEvent |
                                      DrawingToolLoggedUpdateEvent | DrawingToolLoggedDeleteEvent;

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
    }
  }));
export type DrawingToolMetadataModelType = Instance<typeof DrawingToolMetadataModel>;

export function defaultDrawingContent(options?: IDefaultContentOptions) {
  let stamps: StampModelType[] = [];
  if (options?.appConfig?.stamps) {
    stamps = options.appConfig.stamps;
  }
  return DrawingContentModel.create({ stamps, changes: [] });
}

export const DrawingContentModel = ToolContentModel
  .named("DrawingTool")
  .props({
    type: types.optional(types.literal(kDrawingToolID), kDrawingToolID),
    changes: types.array(types.string),
    stroke: DefaultToolbarSettings.stroke,
    fill: DefaultToolbarSettings.fill,
    strokeDashArray: DefaultToolbarSettings.strokeDashArray,
    strokeWidth: DefaultToolbarSettings.strokeWidth,
    stamps: types.array(StampModel),
    // is type.maybe to avoid need for migration
    currentStampIndex: types.maybe(types.number)
  })
  .volatile(self => ({
    metadata: undefined as any as DrawingToolMetadataModelType
  }))
  .preProcessSnapshot(snapshot => {
    return isDrawingTileImportSpec(snapshot)
            ? importDrawingTileSpec(snapshot)
            : snapshot;
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    isSelectedButton(button: ToolbarModalButton) {
      return button === self.metadata.selectedButton;
    },
    get selectedButton() {
      return self.metadata.selectedButton;
    },
    get hasSelectedObjects() {
      return self.metadata.selection.length > 0;
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
      return exportDrawingTileSpec(self.changes, options);
    }
  }))
  .extend(self => {

    function applyChange(change: DrawingToolChange) {
      self.changes.push(JSON.stringify(change));

      let loggedChangeProps = {...change} as DrawingToolChangeLoggedEvent;
      delete loggedChangeProps.data;
      if (!Array.isArray(change.data)) {
        // flatten change.properties
        loggedChangeProps = {
          ...loggedChangeProps,
          ...change.data
        };
      } else {
        // or clean up MST array
        loggedChangeProps.properties = Array.from(change.data as string[]);
      }
      delete loggedChangeProps.action;
      Logger.logToolChange(LogEventName.DRAWING_TOOL_CHANGE, change.action,
        loggedChangeProps, self.metadata?.id ?? "");
    }

    function deleteSelectedObjects() {
      if (self.metadata.selection.length > 0) {
        const deletionChange: DrawingToolChange = {
          action: "delete",
          data: self.metadata.selection
        };
        applyChange(deletionChange);
        self.metadata.setSelection([]);
      }
    }

    function updateSelectedObjects(prop: string, newValue: string|number) {
      if (self.metadata.selection.length > 0) {
        const updateChange: DrawingToolChange = {
          action: "update",
          data: {
            ids: self.metadata.selection,
            update: {
              prop,
              newValue
            }
          }
        };
        applyChange(updateChange);
      }
    }

    return {
      actions: {
        doPostCreate(metadata: DrawingToolMetadataModelType) {
          self.metadata = metadata;
        },

        setStroke(stroke: string) {
          self.stroke = stroke;
          updateSelectedObjects("stroke", stroke);
        },
        setFill(fill: string) {
          self.fill = fill;
          updateSelectedObjects("fill", fill);
        },
        setStrokeDashArray(strokeDashArray: string) {
          self.strokeDashArray = strokeDashArray;
          updateSelectedObjects("strokeDashArray", strokeDashArray);
        },
        setStrokeWidth(strokeWidth: number) {
          self.strokeWidth = strokeWidth;
          updateSelectedObjects("strokeWidth", strokeWidth);
        },

        setSelectedButton(button: ToolbarModalButton) {
          self.metadata.setSelectedButton(button);
        },

        setSelection(ids: string[]) {
          self.metadata.setSelection(ids);
        },

        setSelectedStamp(stampIndex: number) {
          self.currentStampIndex = stampIndex;
        },

        applyChange,
        deleteSelectedObjects,

        // sets the model to how we want it to appear when a user first opens a document
        reset() {
          self.metadata.setSelectedButton("select");
        },
        updateImageUrl(oldUrl: string, newUrl: string) {
          if (!oldUrl || !newUrl || (oldUrl === newUrl)) return;
          // identify change entries to be modified
          const updates: Array<{ index: number, change: string }> = [];
          self.changes.forEach((changeJson, index) => {
            const change = safeJsonParse<DrawingToolChange>(changeJson);
            switch (change?.action) {
              case "create": {
                const createData = change.data as DrawingObjectDataType;
                if ((createData.type === "image") && (createData.url === oldUrl)) {
                  createData.url = newUrl;
                  updates.push({ index, change: JSON.stringify(change) });
                }
                break;
              }
              case "update": {
                const updateData = change.data as DrawingToolUpdate;
                if ((updateData.update.prop === "url") && (updateData.update.newValue === oldUrl)) {
                  updateData.update.newValue = newUrl;
                  updates.push({ index, change: JSON.stringify(change) });
                }
                break;
              }
            }
          });
          // make the corresponding changes
          updates.forEach(update => {
            self.changes[update.index] = update.change;
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
