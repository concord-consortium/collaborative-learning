import { types, Instance } from "mobx-state-tree";
import { Point, DrawingObjectDataType } from "./drawing-objects";
import { safeJsonParse } from "../../../utilities/js-utils";

export const kDrawingToolID = "Drawing";

export const kDrawingDefaultHeight = 320;
export const TOOLBAR_WIDTH = 48;

export type ToolbarModalButton = "select" | "line" | "vector" | "rectangle" | "ellipse" | "stamp";

export interface Color {
  name: string;
  hex: string;
}

export const colors: Color[] = [
  {name: "Aqua",    hex: "#00FFFF"},
  {name: "Black",   hex: "#000000"},
  {name: "Blue",    hex: "#0000FF"},
  {name: "Fuchsia", hex: "#FF00FF"},
  {name: "Gray",    hex: "#808080"},
  {name: "Green",   hex: "#008000"},
  {name: "Lime",    hex: "#00FF00"},
  {name: "Maroon",  hex: "#800000"},
  {name: "Navy",    hex: "#000080"},
  {name: "Olive",   hex: "#808000"},
  {name: "Purple",  hex: "#800080"},
  {name: "Red",     hex: "#FF0000"},
  {name: "Silver",  hex: "#C0C0C0"},
  {name: "Teal",    hex: "#008080"},
  {name: "Yellow",  hex: "#FFFF00"}
];

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

export const computeStrokeDashArray = (type: string, strokeWidth: string|number) => {
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

export const StampModel = types.model("Stamp", {
  url: types.string,
  width: types.number,
  height: types.number
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
      self.selectedButton = button;
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
    currentStampIndex: types.maybe(types.number)
  })
  .volatile(self => ({
    metadata: undefined as any as DrawingToolMetadataModelType
  }))
  .extend(self => {

    function applyChange(change: DrawingToolChange) {
      self.changes.push(JSON.stringify(change));
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
      views: {
        get isUserResizable() {
          return true;
        },
        get selectedButton() {
          return self.metadata.selectedButton;
        },
        get hasSelectedObjects() {
          return self.metadata.selection.length > 0;
        },
        get currentStamp() {
          // is type.maybe to avoid need for migration
          const currentStampIndex = self.currentStampIndex || 0;
          if (currentStampIndex < self.stamps.length) {
            return self.stamps[currentStampIndex];
          }
          return null;
        }
      },
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
              case "create":
                const createData = change.data as DrawingObjectDataType;
                if ((createData.type === "image") && (createData.url === oldUrl)) {
                  createData.url = newUrl;
                  updates.push({ index, change: JSON.stringify(change) });
                }
                break;
              case "update":
                const updateData = change.data as DrawingToolUpdate;
                if ((updateData.update.prop === "url") && (updateData.update.newValue === oldUrl)) {
                  updateData.update.newValue = newUrl;
                  updates.push({ index, change: JSON.stringify(change) });
                }
                break;
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
