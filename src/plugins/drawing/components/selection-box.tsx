import React from "react";
import { Point } from "../model/drawing-basic-types";

const SELECTION_COLOR = "#777";

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
    const { nw, se } = this;
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
    const { nw, se } = this;
    return (p.x >= nw.x) && (p.y >= nw.y) && (p.x <= se.x) && (p.y <= se.y);
  }

  public overlaps(nw2: Point, se2: Point) {
    const { nw, se } = this;
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
    this.nw = { x: minX, y: minY };
    this.se = { x: maxX, y: maxY };
  }
}
