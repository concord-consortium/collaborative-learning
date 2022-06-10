import React from "react";
import { DrawingObjectType, DrawingTool, IDrawingLayer } from "../objects/drawing-object";
import { DrawingLayerView } from "./drawing-layer";

export class SelectionDrawingTool extends DrawingTool {
  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    // We are internal so we can use some private stuff not exposed by 
    // IDrawingLayer
    const drawingLayerView = this.drawingLayer as DrawingLayerView;
    const addToSelectedObjects = e.ctrlKey || e.metaKey;
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    drawingLayerView.startSelectionBox(start);

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      const p = this.drawingLayer.getWorkspacePoint(e2);
      if (!p) return;
      drawingLayerView.updateSelectionBox(p);
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      drawingLayerView.endSelectionBox(addToSelectedObjects);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  public handleObjectClick(e: React.MouseEvent<HTMLDivElement>, obj: DrawingObjectType) {
    // We are internal so we can use some private stuff not exposed by 
    // IDrawingLayer
    const drawingLayerView = this.drawingLayer as DrawingLayerView;
    const { selectedObjects } = drawingLayerView.state;
    const index = selectedObjects.indexOf(obj);
    if (index === -1) {
      selectedObjects.push(obj);
    }
    else {
      selectedObjects.splice(index, 1);
    }
    drawingLayerView.setSelectedObjects(selectedObjects);
  }
}
