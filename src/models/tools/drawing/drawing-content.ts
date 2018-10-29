import { types, Instance } from "mobx-state-tree";
import { Point, DrawingObjectDataType } from "./drawing-objects";
import { number } from "mobx-state-tree/dist/internal";

export const kDrawingToolID = "Drawing";

export const kDrawingDefaultHeight = 320;
export const TOOLBAR_WIDTH = 48;

export type ToolbarModalButton = "select" | "line" | "vector" | "rectangle" | "ellipse";

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

export function defaultDrawingContent() {
  return DrawingContentModel.create({
    type: kDrawingToolID,
    changes: []
  });
}

export const DrawingContentModel = types
  .model("DrawingTool", {
    type: types.optional(types.literal(kDrawingToolID), kDrawingToolID),
    changes: types.array(types.string),
    selectedButton: "select",
    stroke: DefaultToolbarSettings.stroke,
    fill: DefaultToolbarSettings.fill,
    strokeDashArray: DefaultToolbarSettings.strokeDashArray,
    strokeWidth: DefaultToolbarSettings.strokeWidth,
    selectedObjectIds: types.array(types.string)
  })
  .extend(self => {

    function applyChange(change: DrawingToolChange) {
      self.changes.push(JSON.stringify(change));
    }

    function deleteSelectedObjects() {
      if (self.selectedObjectIds.length > 0) {
        const deletionChange: DrawingToolChange = {
          action: "delete",
          data: self.selectedObjectIds
        };
        applyChange(deletionChange);
      }
    }

    function updateSelectedObjects(prop: string, newValue: string|number) {
      if (self.selectedObjectIds.length > 0) {
        const updateChange: DrawingToolChange = {
          action: "update",
          data: {
            ids: self.selectedObjectIds,
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
        }
      },
      actions: {
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
          self.selectedButton = button;
        },

        setSelectedObjectIds(ids: string[]) {
          self.selectedObjectIds.replace(ids);
        },

        applyChange,
        deleteSelectedObjects,

        // sets the model to how we want it to appear when a user first opens a document
        reset: () => {
          self.selectedButton = "select";
        }
      }
    };
  });

export type DrawingContentModelType = Instance<typeof DrawingContentModel>;
