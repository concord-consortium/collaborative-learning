import React from "react";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { DrawingObjectType, DrawingTool, IDrawingLayer, isEditableObject } from "../objects/drawing-object";

export class SelectionDrawingTool extends DrawingTool {
  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const drawingLayerView = this.drawingLayer;
    const addToSelectedObjects = e.ctrlKey || e.metaKey || e.shiftKey;
    const start = this.drawingLayer.getWorkspacePoint(e);
    let moved = false;
    if (!start) return;

    // Don't propagate event to do normal Cmd-click procesing, in case user is dragging a selection.
    e.stopPropagation();

    drawingLayerView.startSelectionBox(start);

    const handlePointerMove = (e2: PointerEvent) => {
      e2.preventDefault();
      if (!moved) {
        // User started to drag. Make sure tile is selected.
        moved = true;
        drawingLayerView.selectTile(false);
      }
      const p = this.drawingLayer.getWorkspacePoint(e2);
      if (!p) return;
      drawingLayerView.updateSelectionBox(p);
    };

    const handlePointerUp = (e2: PointerEvent) => {
      e2.preventDefault();
      drawingLayerView.endSelectionBox(addToSelectedObjects);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      if (!moved) {
        // User just clicked on the canvas w/no drag. They may be trying to select or deselect the tile.
        this.drawingLayer.selectTile(hasSelectionModifier(e2));
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  public handleObjectClick(e: React.PointerEvent<HTMLDivElement>, obj: DrawingObjectType) {
    const selectedObjects = this.drawingLayer.getSelectedObjects();
    const index = selectedObjects.indexOf(obj);
    if (index === -1) {
      if (e.shiftKey || e.metaKey){
        selectedObjects.push(obj);
        this.drawingLayer.setSelectedObjects(selectedObjects);
      }
      else {
        this.drawingLayer.setSelectedObjects([obj]);
      }
    }
    else {
      if (!(e.shiftKey||e.metaKey)){
        if (isEditableObject(obj)) {
          obj.setEditing(true);
        } else {
          selectedObjects.splice(index, 1);
          this.drawingLayer.setSelectedObjects(selectedObjects);
        }
      }
    }
  }
}
