import React from "react";
import { Point } from "../model/drawing-objects";
import { DrawingObjectType } from "../model/drawing-objects2";
import { DefaultToolbarSettings, ToolbarSettings } from "../model/drawing-types";
import { StampModelType } from "../model/stamp";

export interface IDrawingComponentProps {
  model: DrawingObjectType;
  handleHover?: (e: MouseEvent | React.MouseEvent<any>, obj: DrawingObjectType, hovering: boolean) => void;
}

export type DrawingComponentType = React.ComponentType<IDrawingComponentProps>;

export interface IDrawingLayer {
  getWorkspacePoint: (e:MouseEvent|React.MouseEvent<any>) => Point|null;
  setCurrentDrawingObject: (object: DrawingObjectType|null) => void;
  addNewDrawingObject: (object: DrawingObjectType) => void;
  getCurrentStamp: () => StampModelType|null;
}

interface IDrawingTool {
  handleMouseDown?(e: React.MouseEvent<HTMLDivElement>): void;
  handleObjectClick?(e: MouseEvent|React.MouseEvent<any>, obj: DrawingObjectType): void;
  setSettings(settings: ToolbarSettings): IDrawingTool;
}

export abstract class DrawingTool implements IDrawingTool {
  public drawingLayer: IDrawingLayer;
  public settings: ToolbarSettings;

  constructor(drawingLayer: IDrawingLayer) {
    const {stroke, fill, strokeDashArray, strokeWidth} = DefaultToolbarSettings;
    this.drawingLayer = drawingLayer;
    this.settings = {
      stroke,
      fill,
      strokeDashArray,
      strokeWidth
    };
  }

  public setSettings(settings: ToolbarSettings) {
    this.settings = settings;
    return this;
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    // handled in subclass
  }

  public handleObjectClick(e: MouseEvent|React.MouseEvent<any>, obj: DrawingObjectType): void   {
    // handled in subclass
  }
}
