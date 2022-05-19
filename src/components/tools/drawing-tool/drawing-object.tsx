import React from "react";
import { DrawingObjectDataType, Point } from "../../../models/tools/drawing/drawing-objects";
import { uniqueId } from "../../../utilities/js-utils";
import { DrawingLayerView } from "./drawing-layer";

const SELECTION_COLOR = "#777";

interface BoundingBox {
  nw: Point;
  se: Point;
}

export interface DrawingObjectOptions {
  id: any;
  handleHover?: (e: MouseEvent|React.MouseEvent<any>, obj: DrawingObject, hovering: boolean) => void;
  drawingLayer: DrawingLayerView;
}

export default abstract class DrawingObject {
  public model: DrawingObjectDataType;

  constructor(model: DrawingObjectDataType) {
    this.model = model;
    this.model.id = this.model.id || uniqueId();
  }

  public inSelection(selectionBox: SelectionBox) {
    const {nw, se} = this.getBoundingBox();
    return selectionBox.overlaps(nw, se);
  }

  public abstract getBoundingBox(): BoundingBox;
  public abstract render(options: DrawingObjectOptions): JSX.Element | null;
}

export class SelectionBox {
  private start: Point;
  private end: Point;
  private nw: Point;
  private se: Point;

  constructor(start: Point) {
    this.start = start;
    this.end = start;
    this.computeBox();
  }

  public render() {
    const {nw, se} = this;
    return <rect
      x={nw.x}
      y={nw.y}
      width={se.x - nw.x}
      height={se.y - nw.y}
      fill="none"
      stroke={SELECTION_COLOR}
      strokeWidth="1"
      strokeDasharray="5 3"
    />;
  }

  public contains(p: Point): boolean {
    const {nw, se} = this;
    return (p.x >= nw.x) && (p.y >= nw.y) && (p.x <= se.x) && (p.y <= se.y);
  }

  public overlaps(nw2: Point, se2: Point) {
    const {nw, se} = this;
    return  ((nw.x < se2.x) && (se.x > nw2.x) && (nw.y < se2.y) && (se.y > nw2.y));
  }

  public update(p: Point) {
    this.end = p;
    this.computeBox();
  }

  public close() {
    this.computeBox();
  }

  private computeBox() {
    const minX = Math.min(this.start.x, this.end.x);
    const minY = Math.min(this.start.y, this.end.y);
    const maxX = Math.max(this.start.x, this.end.x);
    const maxY = Math.max(this.start.y, this.end.y);
    this.nw = {x: minX, y: minY};
    this.se = {x: maxX, y: maxY};
  }
}
