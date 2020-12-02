import { types, Instance } from "mobx-state-tree";
import { Point, DrawingObjectDataType } from "./drawing-objects";
import { registerToolContentInfo } from "../tool-content-info";
import { safeJsonParse } from "../../../utilities/js-utils";
import { Logger, LogEventName } from "../../../lib/logger";

export const kDrawingToolID = "Drawing";

export const kDrawingDefaultHeight = 180;

export type ToolbarModalButton = "select" | "line" | "vector" | "rectangle" | "ellipse" | "stamp";

export interface ToolbarSettings {
  stroke: string;
  fill: string;
  strokeDashArray: string;
  strokeWidth: number;
}

export const DefaultToolbarSettings: ToolbarSettings = {
  stroke: "#000000",
  fill: "none",
  strokeDashArray: "",
  strokeWidth: 2
};

export const computeStrokeDashArray = (type?: string, strokeWidth?: string|number) => {
  const dotted = strokeWidth;
  const dashed = (strokeWidth as number) * 3;
  switch (type) {
    case "dotted":
      return `${dotted},${dotted}`;
    case "dashed":
      return `${dashed},${dashed}`;
    default:
      return "";
  }
};

export type DrawingToolChangeAction = "create" | "move" | "update" | "delete" ;

export type DrawingToolMove = Array<{id: string, destination: Point}>;
export interface DrawingToolUpdate {
  ids: string[];
  update: {
    prop: string;
    newValue: string|number;
  };
}
export type DrawingToolDeletion = string[];

export interface DrawingToolChange {
  action: DrawingToolChangeAction;
  data: DrawingObjectDataType | DrawingToolMove | DrawingToolUpdate | DrawingToolDeletion;
}
interface DrawingToolChangeLoggedEvent extends Partial<DrawingToolChange> {
  properties?: string[];
}

export const StampModel = types
  .model("Stamp", {
    url: types.string,
    width: types.number,
    height: types.number
  })
  .preProcessSnapshot(snapshot => {
    // The set of available stamps is saved with each drawing tool instance (why?).
    // Thus, we have to convert from pre-webpack/assets reform paths to curriculum
    // paths on loading documents.
    const newUrl = snapshot?.url?.replace("assets/tools/drawing-tool/stamps",
                                          "curriculum/moving-straight-ahead/stamps");
    return newUrl && (newUrl !== snapshot?.url)
            ? { ...snapshot, ...{ url: newUrl } }
            : snapshot;
  });
export type StampModelType = Instance<typeof StampModel>;

// track selection in metadata object so it is not saved to firebase but
// also is preserved across document/content reloads
export const DrawingToolMetadataModel = types
  .model("DrawingToolMetadata", {
    id: types.string,
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

export function defaultDrawingContent(options?: {stamps: StampModelType[]}) {
  return DrawingContentModel.create({
    type: kDrawingToolID,
    stamps: options && options.stamps || [],
    changes: []
  });
}

export const DrawingContentModel = types
  .model("DrawingTool", {
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
        loggedChangeProps, self.metadata ? self.metadata.id : "");
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

        setSelectedStamp(stampIdex: number) {
          self.currentStampIndex = stampIdex;
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
            const change: DrawingToolChange = safeJsonParse(changeJson);
            switch (change && change.action) {
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
  });

export type DrawingContentModelType = Instance<typeof DrawingContentModel>;

registerToolContentInfo({
  id: kDrawingToolID,
  tool: "drawing",
  modelClass: DrawingContentModel,
  defaultHeight: kDrawingDefaultHeight,
  defaultContent: defaultDrawingContent
});
