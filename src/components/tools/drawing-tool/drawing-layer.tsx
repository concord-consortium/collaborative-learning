import React from "react";
import { extractDragTileType, kDragTileContent } from "../tool-tile";
import { computeStrokeDashArray, DrawingContentModelType } from "../../../models/tools/drawing/drawing-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DrawingObjectDataType, LineDrawingObjectData, VectorDrawingObjectData, RectangleDrawingObjectData,
  EllipseDrawingObjectData, Point, ImageDrawingObjectData,
  VariableDrawingObjectData} from "../../../models/tools/drawing/drawing-objects";
import {
  DefaultToolbarSettings, DrawingToolChange, DrawingToolDeletion, DrawingToolMove, DrawingToolUpdate, ToolbarSettings
} from "../../../models/tools/drawing/drawing-types";
import { getUrlFromImageContent, isPlaceholderImage } from "../../../utilities/image-utils";
import { safeJsonParse, uniqueId } from "../../../utilities/js-utils";
import { assign, filter } from "lodash";
import { reaction, IReactionDisposer, autorun } from "mobx";
import { observer } from "mobx-react";
import { ImageContentSnapshotOutType } from "../../../models/tools/image/image-content";
import { gImageMap } from "../../../models/image-map";
import placeholderImage from "../../../assets/image_placeholder.png";
import { Variable } from "@concord-consortium/diagram-view";
import { VariableChip } from "../../../plugins/shared-variables/slate/variable-chip";
import { elementIsOrContains } from "@blueprintjs/core/lib/esm/common/utils";
import { isVisible } from "@testing-library/user-event/dist/utils";

const SELECTION_COLOR = "#777";
const HOVER_COLOR = "#bbdd00";
const SELECTION_BOX_PADDING = 10;

/**  ======= Drawing Objects ======= */

interface BoundingBox {
  nw: Point;
  se: Point;
}
export interface DrawingObjectOptions {
  id: any;
  handleHover?: (e: MouseEvent|React.MouseEvent<any>, obj: DrawingObject, hovering: boolean) => void;
  drawingLayer: DrawingLayerView;
}

export abstract class DrawingObject {
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

class LineObject extends DrawingObject {
  declare model: LineDrawingObjectData;

  constructor(model: LineDrawingObjectData) {
    super(model);
  }

  public inSelection(selectionBox: SelectionBox) {
    const {x, y, deltaPoints} = this.model;
    for (const {dx, dy} of deltaPoints) {
      const point: Point = {x: x + dx, y: y + dy};
      if (selectionBox.contains(point)) {
        return true;
      }
    }
    return false;
  }

  public getBoundingBox() {
    const {x, y, deltaPoints} = this.model;
    const nw: Point = {x, y};
    const se: Point = {x, y};
    let lastPoint: Point = {x, y};
    deltaPoints.forEach((dp) => {
      nw.x = Math.min(nw.x, lastPoint.x + dp.dx);
      nw.y = Math.min(nw.y, lastPoint.y + dp.dy);
      se.x = Math.max(se.x, lastPoint.x + dp.dx);
      se.y = Math.max(se.y, lastPoint.y + dp.dy);
      lastPoint = {x: lastPoint.x + dp.dx, y: lastPoint.y + dp.dy};
    });
    return {nw, se};
  }

  public render(options: DrawingObjectOptions): JSX.Element|null {
    const {x, y, deltaPoints, stroke, strokeWidth, strokeDashArray} = this.model;
    const {id, handleHover} = options;
    const commands = `M ${x} ${y} ${deltaPoints.map((point) => `l ${point.dx} ${point.dy}`).join(" ")}`;
    return <path
              key={id}
              d={commands}
              stroke={stroke}
              fill="none"
              strokeWidth={strokeWidth}
              strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}
              onMouseEnter={(e) => handleHover ? handleHover(e, this, true) : null }
              onMouseLeave={(e) => handleHover ? handleHover(e, this, false) : null }
             />;
  }
}

class VectorObject extends DrawingObject {
  declare model: VectorDrawingObjectData;

  constructor(model: VectorDrawingObjectData) {
    super(model);
  }

  public getBoundingBox() {
    const {x, y, dx, dy} = this.model;
    const nw: Point = {x: Math.min(x, x + dx), y: Math.min(y, y + dy)};
    const se: Point = {x: Math.max(x, x + dx), y: Math.max(y, y + dy)};
    return {nw, se};
  }

  public render(options: DrawingObjectOptions): JSX.Element|null {
    const {x, y, dx, dy, stroke, strokeWidth, strokeDashArray} = this.model;
    const {id, handleHover} = options;
    return <line
              key={id}
              x1={x}
              y1={y}
              x2={x + dx}
              y2={y + dy}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}
              onMouseEnter={(e) => handleHover ? handleHover(e, this, true) : null }
              onMouseLeave={(e) => handleHover ? handleHover(e, this, false) : null }
             />;
  }
}

class RectangleObject extends DrawingObject {
  declare model: RectangleDrawingObjectData;

  constructor(model: RectangleDrawingObjectData) {
    super(model);
  }
  public getBoundingBox() {
    const {x, y, width, height} = this.model;
    const nw: Point = {x, y};
    const se: Point = {x: x + width, y: y + height};
    return {nw, se};
  }

  public render(options: DrawingObjectOptions): JSX.Element|null {
    const {x, y, width, height, stroke, strokeWidth, strokeDashArray, fill} = this.model;
    const {id, handleHover} = options;
    return <rect
              key={id}
              x={x}
              y={y}
              width={width}
              height={height}
              stroke={stroke}
              fill={fill}
              strokeWidth={strokeWidth}
              strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}
              onMouseEnter={(e) => handleHover ? handleHover(e, this, true) : null }
              onMouseLeave={(e) => handleHover ? handleHover(e, this, false) : null }
             />;
  }
}

class EllipseObject extends DrawingObject {
  declare model: EllipseDrawingObjectData;

  constructor(model: EllipseDrawingObjectData) {
    super(model);
  }

  public getBoundingBox() {
    const {x, y, rx, ry} = this.model;
    const nw: Point = {x: x - rx, y: y - ry};
    const se: Point = {x: x + rx, y: y + ry};
    return {nw, se};
  }

  public render(options: DrawingObjectOptions): JSX.Element|null {
    const {x, y, rx, ry, stroke, strokeWidth, strokeDashArray, fill} = this.model;
    const {id, handleHover} = options;
    return <ellipse
              key={id}
              cx={x}
              cy={y}
              rx={rx}
              ry={ry}
              stroke={stroke}
              fill={fill}
              strokeWidth={strokeWidth}
              strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}
              onMouseEnter={(e) => handleHover ? handleHover(e, this, true) : null }
              onMouseLeave={(e) => handleHover ? handleHover(e, this, false) : null }
             />;
  }
}

class ImageObject extends DrawingObject {
  declare model: ImageDrawingObjectData;

  constructor(model: ImageDrawingObjectData) {
    super(model);
  }
  public getBoundingBox() {
    const {x, y, width, height} = this.model;
    const nw: Point = {x, y};
    const se: Point = {x: x + width, y: y + height};
    return {nw, se};
  }

  public render(options: DrawingObjectOptions): JSX.Element|null {
    const {url, x, y, width, height} = this.model;
    const {id, handleHover} = options;
    // will need to convert this url to a runtime url when image refactor is complete
    return <image
              key={id}
              href={url}
              x={x}
              y={y}
              width={width}
              height={height}
              onMouseEnter={(e) => handleHover ? handleHover(e, this, true) : null }
              onMouseLeave={(e) => handleHover ? handleHover(e, this, false) : null }
             />;
  }
}

class VariableObject extends DrawingObject {
  declare model: VariableDrawingObjectData;

  constructor(model: VariableDrawingObjectData) {
    super(model);
  }

  public getBoundingBox() {
    const {x, y, width, height} = this.model;
    const nw: Point = {x, y};
    const se: Point = {x: x + width, y: y + height};
    return {nw, se};
  }

  public render(options: DrawingObjectOptions): JSX.Element|null {
    const {x, y, width, height, name, value} = this.model;
    const {id, handleHover} = options;

    const varChipStyle = { border: "1px solid black",
      borderRadius: "5px",
      padding: "1px 3px",
      margin: "0 1px",
      width: "fit-content",
    };
      // userSelect: none};
    const varObj = Variable.create({name: "pool", value: 15, unit: "totalballs"});

    return (
          <foreignObject
            key={id}
            x={x}
            y={y}
            width={width}
            height={height}
            overflow="visible"
            onMouseEnter={(e) => handleHover ? handleHover(e, this, true) : null }
            onMouseLeave={(e) => handleHover ? handleHover(e, this, false) : null }
          >
            <div style={varChipStyle} id={id}>
              <VariableChip variable={varObj} />
            </div>
          </foreignObject>
    );
  }
}

type DrawableObject = LineObject | VectorObject | RectangleObject | EllipseObject;
type DrawingObjectUnion = DrawableObject | ImageObject | VariableObject;

/**  ======= Drawing Tools ======= */

interface IDrawingTool {
  handleMouseDown?(e: React.MouseEvent<HTMLDivElement>): void;
  handleObjectClick?(e: MouseEvent|React.MouseEvent<any>, obj: DrawingObject): void;
  setSettings(settings: ToolbarSettings): IDrawingTool;
}

abstract class DrawingTool implements IDrawingTool {
  public drawingLayer: DrawingLayerView;
  public settings: ToolbarSettings;

  constructor(drawingLayer: DrawingLayerView) {
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

  public handleObjectClick(e: MouseEvent|React.MouseEvent<any>, obj: DrawingObject): void   {
    // handled in subclass
  }
}

class LineDrawingTool extends DrawingTool {

  constructor(drawingLayer: DrawingLayerView) {
    super(drawingLayer);
    this.drawingLayer = drawingLayer;
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, strokeWidth, strokeDashArray} = this.settings;
    const line: LineObject = new LineObject({type: "line", x: start.x, y: start.y,
      deltaPoints: [], stroke, strokeWidth, strokeDashArray});

    let lastPoint = start;
    const addPoint = (e2: MouseEvent|React.MouseEvent<HTMLDivElement>) => {
      const p = this.drawingLayer.getWorkspacePoint(e2);
      if (!p) return;
      if ((p.x >= 0) && (p.y >= 0)) {
        line.model.deltaPoints.push({dx: p.x - lastPoint.x, dy: p.y - lastPoint.y});
        lastPoint = p;
        this.drawingLayer.setState({currentDrawingObject: line});
      }
    };

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      addPoint(e2);
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      if (line.model.deltaPoints.length > 0) {
        addPoint(e2);
        this.drawingLayer.addNewDrawingObject(line.model);
      }
      this.drawingLayer.setState({currentDrawingObject: null});
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    this.drawingLayer.setState({currentDrawingObject: line});
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }
}

class VectorDrawingTool extends DrawingTool {

  constructor(drawingLayer: DrawingLayerView) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, strokeWidth, strokeDashArray} = this.settings;
    const vector: VectorObject = new VectorObject({
      type: "vector",
      x: start.x,
      y: start.y,
      dx: 0,
      dy: 0,
      stroke, strokeWidth, strokeDashArray});

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      const end = this.drawingLayer.getWorkspacePoint(e2);
      if (!end) return;
      let dx = end.x - start.x;
      let dy = end.y - start.y;
      if (e2.ctrlKey || e2.altKey || e2.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) {
          dy = 0;
        } else {
          dx = 0;
        }
      }
      vector.model.dx = dx;
      vector.model.dy = dy;
      this.drawingLayer.setState({currentDrawingObject: vector});
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      if ((vector.model.dx !== 0) || (vector.model.dy !== 0)) {
        this.drawingLayer.addNewDrawingObject(vector.model);
      }
      this.drawingLayer.setState({currentDrawingObject: null});
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    this.drawingLayer.setState({currentDrawingObject: vector});
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }
}

class RectangleDrawingTool extends DrawingTool {

  constructor(drawingLayer: DrawingLayerView) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, fill, strokeWidth, strokeDashArray} = this.settings;
    const rectangle: RectangleObject = new RectangleObject({
      type: "rectangle",
      x: start.x,
      y: start.y,
      width: 0,
      height: 0,
      stroke, fill, strokeWidth, strokeDashArray
    });

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      const end = this.drawingLayer.getWorkspacePoint(e2);
      if (!end) return;
      rectangle.model.x = Math.min(start.x, end.x);
      rectangle.model.y = Math.min(start.y, end.y);
      rectangle.model.width = Math.max(start.x, end.x) - rectangle.model.x;
      rectangle.model.height = Math.max(start.y, end.y) - rectangle.model.y;
      if (e2.ctrlKey || e2.altKey || e2.shiftKey) {
        let {x, y} = rectangle.model;
        const {width, height} = rectangle.model;
        const squareSize = Math.max(width, height);

        if (x === start.x) {
          if (y !== start.y) {
            y = start.y - squareSize;
          }
        }
        else {
          x = start.x - squareSize;
          if (y !== start.y) {
            y = start.y - squareSize;
          }
        }

        rectangle.model.x = x;
        rectangle.model.y = y;
        rectangle.model.width = rectangle.model.height = squareSize;
      }
      this.drawingLayer.setState({currentDrawingObject: rectangle});
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      if ((rectangle.model.width > 0) && (rectangle.model.height > 0)) {
        this.drawingLayer.addNewDrawingObject(rectangle.model);
      }
      this.drawingLayer.setState({currentDrawingObject: null});
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    this.drawingLayer.setState({currentDrawingObject: rectangle});
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }
}

class EllipseDrawingTool extends DrawingTool {

  constructor(drawingLayer: DrawingLayerView) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, fill, strokeWidth, strokeDashArray} = this.settings;
    const ellipse: EllipseObject = new EllipseObject({
      type: "ellipse",
      x: start.x,
      y: start.y,
      rx: 0,
      ry: 0,
      stroke, fill, strokeWidth, strokeDashArray
    });

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      const end = this.drawingLayer.getWorkspacePoint(e2);
      if (!end) return;
      ellipse.model.rx = Math.abs(start.x - end.x);
      ellipse.model.ry = Math.abs(start.y - end.y);
      if (e2.ctrlKey || e2.altKey || e2.shiftKey) {
        ellipse.model.rx = ellipse.model.ry = Math.max(ellipse.model.rx, ellipse.model.ry);
      }
      this.drawingLayer.setState({currentDrawingObject: ellipse});
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      if ((ellipse.model.rx > 0) && (ellipse.model.ry > 0)) {
        this.drawingLayer.addNewDrawingObject(ellipse.model);
      }
      this.drawingLayer.setState({currentDrawingObject: null});
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    this.drawingLayer.setState({currentDrawingObject: ellipse});
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }
}

class StampDrawingTool extends DrawingTool {

  constructor(drawingLayer: DrawingLayerView) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const stamp = this.drawingLayer.getCurrentStamp();
    if (stamp) {
      const stampImage: ImageObject = new ImageObject({
        type: "image",
        url: stamp.url,
        x: start.x - (stamp.width / 2),
        y: start.y - (stamp.height / 2),
        width: stamp.width,
        height: stamp.height
      });

      this.drawingLayer.addNewDrawingObject(stampImage.model);
    }
  }
}

class VariableDrawingTool extends DrawingTool {

  constructor(drawingLayer: DrawingLayerView) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const variableChip: VariableObject = new VariableObject({
      type: "variable",
      x: e.clientX-50,
      y: e.clientY-100,
      width: 75,
      height: 24,
      name: "pool",
      value: "15"
    });

    this.drawingLayer.addNewDrawingObject(variableChip.model);
  }
}

class SelectionDrawingTool extends DrawingTool {
  constructor(drawingLayer: DrawingLayerView) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const addToSelectedObjects = e.ctrlKey || e.metaKey;
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    this.drawingLayer.startSelectionBox(start);

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      const p = this.drawingLayer.getWorkspacePoint(e2);
      if (!p) return;
      this.drawingLayer.updateSelectionBox(p);
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      this.drawingLayer.endSelectionBox(addToSelectedObjects);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  public handleObjectClick(e: React.MouseEvent<HTMLDivElement>, obj: DrawingObject) {
    const {selectedObjects} = this.drawingLayer.state;
    const index = selectedObjects.indexOf(obj);
    if (index === -1) {
      selectedObjects.push(obj);
    }
    else {
      selectedObjects.splice(index, 1);
    }
    this.drawingLayer.setSelectedObjects(selectedObjects);
  }
}

class SelectionBox {
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

/**  ======= Drawing Layer ======= */

interface ObjectMap {
  [key: string]: DrawingObject|null;
}

interface DrawingToolMap {
  [key: string]: DrawingTool;
}

interface DrawingLayerViewProps {
  model: ToolTileModelType;
  readOnly?: boolean;
  scale?: number;
  onSetCanAcceptDrop: (tileId?: string) => void;
}

interface DrawingLayerViewState {
  toolbarSettings?: ToolbarSettings;
  currentDrawingObject: DrawableObject|null;
  selectedObjects: DrawingObject[];
  selectionBox: SelectionBox|null;
  hoverObject: DrawingObject|null;
  isLoading: boolean;
}

@observer
export class DrawingLayerView extends React.Component<DrawingLayerViewProps, DrawingLayerViewState> {
  public currentTool: DrawingTool|null;
  public tools: DrawingToolMap;
  private objects: ObjectMap;
  private svgRef: React.RefObject<any>|null;
  private setSvgRef: (element: any) => void;
  private _isMounted: boolean;
  private disposers: IReactionDisposer[];
  private fetchingImages: string[] = [];
  private actionsCount: number;

  constructor(props: DrawingLayerViewProps) {
    super(props);

    this.state = {
      currentDrawingObject: null,
      selectionBox: null,
      selectedObjects: [],
      hoverObject: null,
      isLoading: false
    };

    this.tools = {
      line: new LineDrawingTool(this),
      vector: new VectorDrawingTool(this),
      selection: new SelectionDrawingTool(this),
      rectangle: new RectangleDrawingTool(this),
      ellipse: new EllipseDrawingTool(this),
      stamp: new StampDrawingTool(this),
      variable: new VariableDrawingTool(this),
    };
    this.currentTool = this.tools.selection;

    this.objects = {};

    this.svgRef = null;
    this.setSvgRef = (element) => {
      this.svgRef = element;
    };

    this.addListeners();
  }

  public componentDidMount() {
    this._isMounted = true;
    this.actionsCount  = 0;
    this.disposers = [];

    this.disposers.push(reaction(
      () => this.getContent().metadata.selectedButton,
      selectedButton => this.syncCurrentTool(selectedButton)
    ));

    this.disposers.push(reaction(
      () => this.getContent().metadata.selection.toJSON(),
      selectedIds => {
        const selectedObjects = selectedIds.map(id => this.objects[id]).filter(obj => !!obj) as DrawingObject[];
        this.setState({ selectedObjects });
      }
    ));

    this.disposers.push(reaction(
      () => this.getContent().toolbarSettings,
      settings => this.setCurrentToolSettings(settings)
    ));

    this.disposers.push(autorun(() => {
      this.syncChanges();
    }));
  }

  public componentWillUnmount() {
    this.disposers.forEach(disposer => disposer());

    this._isMounted = false;
  }

  public syncCurrentTool(selectedButton: string) {
    const settings = this.getContent().toolbarSettings;
    switch (selectedButton) {
      case "select":
        this.setCurrentTool(this.tools.selection);
        break;
      case "line":
        this.setCurrentTool((this.tools.line as LineDrawingTool).setSettings(settings));
        break;
      case "vector":
        this.setCurrentTool((this.tools.vector as VectorDrawingTool).setSettings(settings));
        break;
      case "rectangle":
        this.setCurrentTool((this.tools.rectangle as RectangleDrawingTool).setSettings(settings));
        break;
      case "ellipse":
        this.setCurrentTool((this.tools.ellipse as EllipseDrawingTool).setSettings(settings));
        break;
      case "stamp":
        this.setCurrentTool((this.tools.stamp as StampDrawingTool).setSettings(settings));
        break;
      case "variable":
        this.setCurrentTool((this.tools.variable as VariableDrawingTool).setSettings(settings));
        break;
    }
  }

  public addListeners() {
    window.addEventListener("keyup", (e) => {
      if (!this.props.readOnly) {
        switch (e.key) {
          case "Backspace":
          case "Delete":
          case "Del":             // IE 9 and maybe Edge
            this.handleDelete();
            break;
        }
      }
    });
  }

  public addNewDrawingObject(drawingObjectModel: DrawingObjectDataType) {
    this.sendChange({action: "create", data: drawingObjectModel});
  }

  public addUpdateDrawingObjects(ids: string[], prop: string, newValue: number | string) {
    const update: DrawingToolUpdate = { ids, update: { prop, newValue } };
    this.sendChange({action: "update", data: update});
  }

  public setSelectedObjects(selectedObjects: DrawingObject[]) {
    this.setState({selectionBox: null, selectedObjects});

    const drawingContent = this.props.model.content as DrawingContentModelType;
    const selectedObjectIds = selectedObjects.map(object => object.model.id || "");
    drawingContent.setSelection(selectedObjectIds);
  }

  public setCurrentTool(tool: DrawingTool|null) {
    this.currentTool = tool;
  }

  public setCurrentToolSettings(settings: ToolbarSettings) {
    this.currentTool?.setSettings(settings);
  }

  public getCurrentStamp() {
    const drawingContent = this.props.model.content as DrawingContentModelType;
    return drawingContent.currentStamp;
  }

  public handleDelete() {
    const {selectedObjects} = this.state;
    if (selectedObjects.length > 0) {
      const deletedObjects = selectedObjects.map(object => object.model.id);
      this.sendChange({action: "delete", data: deletedObjects as DrawingToolDeletion});
      this.setSelectedObjects([]);
    }
  }

  public handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!this.props.readOnly && this.currentTool) {
      this.currentTool.handleMouseDown(e);
    }
  };

  public handleObjectClick = (e: MouseEvent|React.MouseEvent<any>, obj: DrawingObject) => {
    if (!this.props.readOnly && this.currentTool) {
      this.currentTool.handleObjectClick(e, obj);
    }
  };

  public handleObjectHover = (e: MouseEvent|React.MouseEvent<any>, obj: DrawingObject, hovering: boolean) => {
    if (!this.props.readOnly && this.currentTool === this.tools.selection) {
      this.setState({hoverObject: hovering ? obj : null});
    }
  };

  // handles dragging of selected/hovered objects
  public handleSelectedObjectMouseDown = (e: React.MouseEvent<any>, obj: DrawingObject) => {
    if (this.props.readOnly) return;
    let moved = false;
    const {selectedObjects, hoverObject} = this.state;
    let objectsToInteract: DrawingObject[];
    let needToAddHoverToSelection = false;
    if (hoverObject && !selectedObjects.some(object => object.model.id === hoverObject.model.id)) {
      objectsToInteract = [hoverObject, ...selectedObjects];
      needToAddHoverToSelection = true;
    } else {
      objectsToInteract = selectedObjects;
    }
    const starting = this.getWorkspacePoint(e);
    if (!starting) return;
    const start = objectsToInteract.map(object => ({x: object.model.x, y: object.model.y}));

    e.stopPropagation();

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      e2.stopPropagation();

      const current = this.getWorkspacePoint(e2);
      if (!current) return;
      const dx = current.x - starting.x;
      const dy = current.y - starting.y;
      moved = moved || ((dx !== 0) && (dy !== 0));

      objectsToInteract.forEach((object, index) => {
        object.model.x = start[index].x + dx;
        object.model.y = start[index].y + dy;
      });

      if (needToAddHoverToSelection) {
        // we delay until we confirm that the user is dragging the objects before adding the hover object
        // to the selection, to avoid messing with the click to select/deselect logic
        this.setSelectedObjects(objectsToInteract);
        needToAddHoverToSelection = false;
      }
      this.forceUpdate();
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      e2.stopPropagation();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (moved) {
        if (objectsToInteract.length > 0) {
          const moves: DrawingToolMove = objectsToInteract.map((object) => ({
            id: object.model.id || "",
            destination: {x: object.model.x, y: object.model.y}
          }));
          this.sendChange({action: "move", data: moves});
        }
      }
      else {
        this.handleObjectClick(e2, obj);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  public startSelectionBox(p: Point) {
    this.setState({selectionBox: new SelectionBox(p)});
  }

  public updateSelectionBox(p: Point) {
    const {selectionBox} = this.state;
    if (selectionBox) {
      selectionBox.update(p);
      this.setState({selectionBox});
    }
  }

  public endSelectionBox(addToSelectedObjects: boolean) {
    const {selectionBox} = this.state;
    if (selectionBox) {
      selectionBox.close();
      const selectedObjects: DrawingObject[] = addToSelectedObjects ? this.state.selectedObjects : [];
      this.forEachObject((object) => {
        if (object.inSelection(selectionBox)) {
          if (selectedObjects.indexOf(object) === -1) {
            selectedObjects.push(object);
          }
        }
      });
      this.setSelectedObjects(selectedObjects);
    }
  }

  // when we add text, this filter can be used with this.renderObjects((object) => object.type !== "text")
  public renderObjects(_filter: (object: DrawingObject) => boolean) {
    return Object.keys(this.objects).map((id) => {
      const object = this.objects[id];
      if (!object || !_filter(object)) {
        return null;
      }
      return object.render({
        id,
        handleHover: this.handleObjectHover,
        drawingLayer: this
      });
    });
  }

  public renderSelectedObjects(selectedObjects: DrawingObject[], color: string) {
    return selectedObjects.map((object, index) => {
      const {nw, se} = object.getBoundingBox();
      nw.x -= SELECTION_BOX_PADDING;
      nw.y -= SELECTION_BOX_PADDING;
      se.x += SELECTION_BOX_PADDING;
      se.y += SELECTION_BOX_PADDING;
      return <rect
                key={index}
                x={nw.x}
                y={nw.y}
                width={se.x - nw.x}
                height={se.y - nw.y}
                fill={color}
                fillOpacity="0"
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray="10 5"
                onMouseDown={(e) => this.handleSelectedObjectMouseDown(e, object)}
                onMouseEnter={(e) => this.handleObjectHover(e, object, true) }
                onMouseLeave={(e) => this.handleObjectHover(e, object, false) }
               />;
    });
  }

  public getWorkspacePoint = (e: MouseEvent|React.MouseEvent<any>): Point|null => {
    if (this.svgRef) {
      const scale = this.props.scale || 1;
      const rect = ((this.svgRef as unknown) as Element).getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale
      };
    }
    return null;
  };

  public render() {
    const hoveringOverAlreadySelectedObject =
      this.state.hoverObject
        ? this.state.selectedObjects.indexOf(this.state.hoverObject) !== -1
        : false;

    return (
      <div className="drawing-layer"
          onMouseDown={this.handleMouseDown}
          onDragOver={this.handleDragOver}
          onDragLeave={this.handleDragLeave}
          onDrop={this.handleDrop} >

        <svg xmlnsXlink="http://www.w3.org/1999/xlink" width={1500} height={1500} ref={this.setSvgRef}>
          {this.renderObjects(object => object.model.type === "image")}
          {this.renderObjects(object => object.model.type !== "image")}
          {this.renderSelectedObjects(this.state.selectedObjects, SELECTION_COLOR)}
          {this.state.hoverObject
            ? this.renderSelectedObjects([this.state.hoverObject], hoveringOverAlreadySelectedObject
              ? SELECTION_COLOR : HOVER_COLOR)
            : null}
          {this.state.currentDrawingObject
            ? this.state.currentDrawingObject.render({id: "current", drawingLayer: this})
            : null}
          {this.state.selectionBox ? this.state.selectionBox.render() : null}
        </svg>
      </div>
    );
  }

  private updateLoadingImages = (url: string, filename?: string) => {
    if (this.fetchingImages.indexOf(url) > -1) return;
    this.fetchingImages.push(url);

    gImageMap.getImage(url, { filename })
      .then(image => {
        if (!this._isMounted) return;
        // update all images with this originalUrl that have not been updated
        const imageObjs = filter(this.objects,
          obj => {
            if (!!obj && obj.model.type === "image") {
              const _imgObj = obj as ImageObject;
              return _imgObj.model.originalUrl === url &&
              (!_imgObj.model.url || isPlaceholderImage(_imgObj.model.url));
            }
            return false;
          });

        imageObjs.forEach(imgObj =>
          (imgObj as ImageObject).model.url = image.displayUrl || placeholderImage);

        // update react state
        this.setState({ isLoading: false });
        // update mst content if conversion occurred
        if (image.contentUrl && (url !== image.contentUrl)) {
          this.getContent().updateImageUrl(url, image.contentUrl);
        }
      })
      .catch(() => {
        this.setState({ isLoading: false });
      });
  };

  private getContent() {
    return this.props.model.content as DrawingContentModelType;
  }

  private isAcceptableImageDrag = (e: React.DragEvent<HTMLDivElement>) => {
    const { readOnly } = this.props;
    const toolType = extractDragTileType(e.dataTransfer);
    // image drop area is central 80% in each dimension
    const kImgDropMarginPct = 0.1;
    if (!readOnly && (toolType === "image")) {
      const eltBounds = e.currentTarget.getBoundingClientRect();
      const kImgDropMarginX = eltBounds.width * kImgDropMarginPct;
      const kImgDropMarginY = eltBounds.height * kImgDropMarginPct;
      if ((e.clientX > eltBounds.left + kImgDropMarginX) &&
          (e.clientX < eltBounds.right - kImgDropMarginX) &&
          (e.clientY > eltBounds.top + kImgDropMarginY) &&
          (e.clientY < eltBounds.bottom - kImgDropMarginY)) {
        return true;
      }
    }
    return false;
  };

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const isAcceptableDrag = this.isAcceptableImageDrag(e);
    this.props.onSetCanAcceptDrop(isAcceptableDrag ? this.props.model.id : undefined);
    if (isAcceptableDrag) {
      e.dataTransfer.dropEffect = "copy";
      e.preventDefault();
    }
  };

  private handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    this.props.onSetCanAcceptDrop();
  };

  private handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (this.isAcceptableImageDrag(e)) {
      const dragContent = e.dataTransfer.getData(kDragTileContent);
      const parsedContent = safeJsonParse(dragContent);
      if (parsedContent) {
        const droppedContent: ImageContentSnapshotOutType = parsedContent.content;
        const droppedUrl = getUrlFromImageContent(droppedContent);
        if (droppedUrl) {
          this.handleImageDrop(droppedUrl);
        }
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  private handleImageDrop(url: string) {
    gImageMap.getImage(url)
      .then(imageEntry => {
        if (!this._isMounted || !imageEntry.contentUrl) return;
        const image: ImageObject = new ImageObject({
          type: "image",
          url,
          filename: imageEntry.filename,
          x: 0,
          y: 0,
          width: imageEntry.width!,
          height: imageEntry.height!
        });
        this.addNewDrawingObject(image.model);
      });
  }

  private sendChange(change: DrawingToolChange): any {
    const drawingContent = this.props.model.content as DrawingContentModelType;
    drawingContent.applyChange(change);
  }

  private executeChange(change: DrawingToolChange) {
    switch (change.action) {
      case "create":
        this.createDrawingObject(change.data);
        break;
      case "move":
        this.moveDrawingObjects(change.data);
        break;
      case "update":
        this.updateDrawingObjects(change.data);
        break;
      case "delete":
        this.deleteDrawingObjects(change.data);
        break;
    }
  }

  private createDrawingObject(data: DrawingObjectDataType) {
    let drawingObject: DrawingObjectUnion;
    switch (data.type) {
      case "line":
        drawingObject = new LineObject(data);
        break;
      case "vector":
        drawingObject = new VectorObject(data);
        break;
      case "rectangle":
        drawingObject = new RectangleObject(data);
        break;
      case "ellipse":
        drawingObject = new EllipseObject(data);
        break;
      case "image": {
        const imageEntry = gImageMap.getCachedImage(data.url);
        const displayUrl = imageEntry?.displayUrl || "";
        drawingObject = new ImageObject(assign({}, data, { url: displayUrl }));
        if (!imageEntry) {
          drawingObject.model.originalUrl = data.url;
          this.updateImageUrl(data.url, data.filename);
        }
        break;
      }
      case "variable":
        drawingObject = new VariableObject(data);
        break;
    }
    if (drawingObject?.model.id) {
      const objectId = drawingObject.model.id;
      if (this.objects[objectId]) {
        console.warn(`DrawingLayer.createDrawingObject detectected duplicate ${data.type} with id ${objectId}`);
      }
      this.objects[objectId] = drawingObject;
      this.forceUpdate();
    }
  }

  private moveDrawingObjects(moves: DrawingToolMove) {
    for (const move of moves) {
      const drawingObject = this.objects[move.id];
      if (drawingObject) {
        drawingObject.model.x = move.destination.x;
        drawingObject.model.y = move.destination.y;
      }
    }
  }

  private updateImageUrl(url: string, filename?: string) {
    if (!this.state.isLoading) {
      this.setState({ isLoading: true });
    }
    this.updateLoadingImages(url, filename);
  }

  private updateDrawingObjects(update: DrawingToolUpdate) {
    const {ids, update: {prop, newValue}} = update;
    for (const id of ids) {
      const drawingObject = this.objects[id];
      if (drawingObject && Object.prototype.hasOwnProperty.call(drawingObject.model, prop)) {
        if ((drawingObject instanceof ImageObject) && (prop === "url")) {
          const url = newValue as string;
          this.updateImageUrl(url);
        }
        else {
          (drawingObject.model as any)[prop] = newValue;
        }
      }
    }
  }

  private deleteDrawingObjects(idsToDelete: string[]) {
    for (const id of idsToDelete) {
      const drawingObject = this.objects[id];
      if (drawingObject) {
        const {selectedObjects} = this.state;
        const index = selectedObjects.indexOf(drawingObject);
        if (index !== -1) {
          selectedObjects.splice(index, 1);
        }
        delete this.objects[id];
        this.setState({selectedObjects, hoverObject: null});
      }
    }
  }

  private forEachObject(callback: (object: DrawingObject, key?: string) => void) {
    const {objects} = this;
    Object.keys(objects).forEach((id) => {
      const object = objects[id];
      if (object) {
        callback(object, id);
      }
    });
  }

  private syncChanges() {
    const drawingContent = this.props.model.content as DrawingContentModelType;
    const currentChangesLength = drawingContent.changes ? drawingContent.changes.length : 0;
    const prevChanges = this.actionsCount;

    if (currentChangesLength > prevChanges) {
      for (let i = prevChanges; i < currentChangesLength; i++) {
        const change = JSON.parse(drawingContent.changes[i]) as DrawingToolChange;
        this.executeChange(change);
      }
      this.actionsCount = currentChangesLength;
      this.forceUpdate();
    }
  }
}
