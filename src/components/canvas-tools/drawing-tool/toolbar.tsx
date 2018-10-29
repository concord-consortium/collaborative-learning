// tslint:disable:jsx-no-lambda
import * as React from "react";
import { DrawingContentModelType, Color, ToolbarModalButton, TOOLBAR_WIDTH,
  colors, computeStrokeDashArray } from "../../../models/tools/drawing/drawing-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";

export interface TextButtonData {
  color: string;
}

export interface PolygonButtonData {
  type: string;
  stroke?: string;
  fill?: string;
}

export interface LineButtonData {
  lineColor: Color;
}

export interface ToolbarFlyoutViewProps {
  selected: boolean;
}

export interface ToolbarFlyoutViewState {
  open: boolean;
  selectedIndex: number;
}

export interface FlyoutMenuItem {
  title: string;
  icon: string;
}

export class ToolbarFlyoutView extends React.Component<ToolbarFlyoutViewProps, ToolbarFlyoutViewState> {
  constructor(props: ToolbarFlyoutViewProps){
    super(props);

    this.state = {
      open: false,
      selectedIndex: 0
    };
  }

  public render() {
    const {open, selectedIndex} = this.state;
    const children = this.props.children as any;
    const selected = children ? children[selectedIndex] : null;
    if (!selected) {
      return null;
    }
    const {props} = selected;
    const className = this.props.selected ? "button selected" : "button";
    return (
      <div className="flyout-top-button">
        <div className={className} title={props.title} style={props.style}
            onClick={(e) => this.handleChildClick(e, selectedIndex)}>
          {props.children}
        </div>
        {open ? this.renderOpen() : null}
        <div className="flyout-toggle" onClick={this.handleToggleOpen}>{open ? "▼" : "▶"}</div>
      </div>
    );
  }

  private handleToggleOpen = () => {
    this.setState({open: !this.state.open});
  }

  private handleChildClick = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({selectedIndex: index, open: false});
    const children = this.props.children as any;
    const selected = children ? children[index] : null;
    if (selected && selected.props.onClick) {
      selected.props.onClick();
    }
  }

  private renderOpen() {
    const children = React.Children.map(this.props.children, (child, index) => {
      return (
        <div className="flyout-menu-item" onClick={(e) => this.handleChildClick(e, index)}>
          {child}
        </div>
      );
    });
    return (
      <div className="flyout-menu">{children}</div>
    );
  }
}

export interface ToolbarViewProps {
  model: ToolTileModelType;
  readOnly: boolean;
}

export interface ToolbarViewState {
  showSettings: boolean;
}

export class ToolbarView extends React.Component<ToolbarViewProps, ToolbarViewState> {
  constructor(props: ToolbarViewProps){
    super(props);
    this.state = {
      showSettings: false
    };
  }

  public render() {
    const drawingContent = this.props.model.content as DrawingContentModelType;
    const {stroke} = drawingContent;
    return (
      <div className="drawing-tool-toolbar" style={{width: TOOLBAR_WIDTH}}>
        <div className="drawing-tool-buttons">
          <div className="drawing-tool-button" title="Settings" onClick={
            this.handleSettingsButton}>
            <span className="drawing-tool-icon drawing-tool-icon-menu" />
          </div>
          <div className={this.modalButtonClass("select")} title="Select"
              onClick={this.handleSelectionToolButton}>
            <span className="drawing-tool-icon drawing-tool-icon-mouse-pointer" />
          </div>
          <div className={this.modalButtonClass("line")} title="Freehand Tool"
              onClick={this.handleLineDrawingToolButton}>
            <span className="drawing-tool-icon drawing-tool-icon-pencil" style={{color: stroke}} />
          </div>
          <div className={this.modalButtonClass("vector")} style={{height: 30}} title="Line Tool"
              onClick={this.handleVectorToolButton}>
            {this.renderSVGIcon("vector")}
          </div>
          <div className={this.modalButtonClass("rectangle")} style={{height: 30}} title="Rectangle Tool"
              onClick={this.handleRectangleToolButton}>
            {this.renderSVGIcon("rectangle")}
          </div>
          <div className={this.modalButtonClass("ellipse")} style={{height: 30}} title="Ellipse Tool"
              onClick={this.handleEllipseToolButton}>
            {this.renderSVGIcon("ellipse")}
          </div>
          <div className="drawing-tool-button" title="Delete" onClick={this.handleDeleteButton}>
            <span className="drawing-tool-icon drawing-tool-icon-bin" />
          </div>
        </div>
        {this.state.showSettings ? this.renderSettings() : null}
      </div>
    );
  }

  private handleSettingsButton = () => {
    if (this.props.readOnly) return;
    this.setState({showSettings: !this.state.showSettings});
  }
  private handleLineDrawingToolButton = () => {
    if (this.props.readOnly) return;
    const drawingContent = this.props.model.content as DrawingContentModelType;
    drawingContent.setSelectedButton("line");
  }
  private handleVectorToolButton = () => {
    if (this.props.readOnly) return;
    const drawingContent = this.props.model.content as DrawingContentModelType;
    drawingContent.setSelectedButton("vector");
  }
  private handleSelectionToolButton = () => {
    if (this.props.readOnly) return;
    const drawingContent = this.props.model.content as DrawingContentModelType;
    drawingContent.setSelectedButton("select");
  }
  private handleRectangleToolButton = () => {
    if (this.props.readOnly) return;
    const drawingContent = this.props.model.content as DrawingContentModelType;
    drawingContent.setSelectedButton("rectangle");
  }
  private handleEllipseToolButton = () => {
    if (this.props.readOnly) return;
    const drawingContent = this.props.model.content as DrawingContentModelType;
    drawingContent.setSelectedButton("ellipse");
  }
  private handleDeleteButton = () => {
    if (this.props.readOnly) return;
    const drawingContent = this.props.model.content as DrawingContentModelType;
    drawingContent.deleteSelectedObjects();
  }

  private handleStrokeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (this.props.readOnly) return;
    (this.props.model.content as DrawingContentModelType).setStroke(e.target.value);
  }
  private handleFillChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (this.props.readOnly) return;
    (this.props.model.content as DrawingContentModelType).setFill(e.target.value);
  }
  private handleStrokeDashArrayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (this.props.readOnly) return;
    (this.props.model.content as DrawingContentModelType).setStrokeDashArray(e.target.value);
  }
  private handleStrokeWidthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (this.props.readOnly) return;
    (this.props.model.content as DrawingContentModelType).setStrokeWidth(+e.target.value);
  }

  private modalButtonClass(type: ToolbarModalButton) {
    const drawingContent = this.props.model.content as DrawingContentModelType;
    const selected = type === drawingContent.selectedButton;
    return `drawing-tool-button ${selected ? "selected" : ""}`;
  }

  private renderSettings() {
    const drawingContent = this.props.model.content as DrawingContentModelType;
    const {stroke, fill, strokeDashArray, strokeWidth} = drawingContent;
    const pluralize = (text: string, count: number) => count === 1 ? text : `${text}s`;
    return (
      <div className="settings" style={{left: TOOLBAR_WIDTH}}>
        <div className="title"><span className="icon icon-menu" /> Settings</div>
        <form>
          <div className="form-group">
            <label htmlFor="stroke">Color</label>
            <select value={stroke} name="stroke" onChange={this.handleStrokeChange}>
              {colors.map((color, index) => <option value={color.hex} key={index}>{color.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="fill">Fill</label>
            <select value={fill} name="fill" onChange={this.handleFillChange}>
              <option value="none" key="none">None</option>
              {colors.map((color, index) => <option value={color.hex} key={index}>{color.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="strokeDashArray">Stroke</label>
            <select value={strokeDashArray} name="strokeDashArray"
                onChange={this.handleStrokeDashArrayChange}>
              <option value="">Solid</option>
              <option value="dotted">Dotted</option>
              <option value="dashed">Dashed</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="strokeWidth">Thickness</label>
            <select value={strokeWidth} name="strokeWidth" onChange={this.handleStrokeWidthChange}>
              {[1, 2, 3, 4, 5].map((_strokeWidth) => {
                return (
                  <option value={_strokeWidth} key={_strokeWidth}>
                    {_strokeWidth} {pluralize("pixel", _strokeWidth)}
                  </option>
                );
              })}
            </select>
          </div>
        </form>
      </div>
    );
  }

  private renderSVGIcon(button: ToolbarModalButton) {
    const drawingContent = this.props.model.content as DrawingContentModelType;
    const {stroke, fill, strokeDashArray, strokeWidth} = drawingContent;
    let iconElement: JSX.Element|null = null;
    const iconSize = 30;
    const iconMargin = 5;
    const elementSize = iconSize - (2 * iconMargin);
    const elementHalfSize = elementSize / 2;

    switch (button) {
      case "rectangle":
        iconElement = <rect width={elementSize} height={elementSize} />;
        break;
      case "ellipse":
        iconElement = <ellipse cx={elementHalfSize} cy={elementHalfSize} rx={elementHalfSize} ry={elementHalfSize}  />;
        break;
      case "vector":
        iconElement = <line x1={0} y1={elementSize} x2={elementSize} y2={0}  />;
        break;
    }

    return (
      <svg width={iconSize} height={iconSize}>
        <g transform={`translate(${iconMargin},${iconMargin})`} fill={fill} stroke={stroke} strokeWidth={strokeWidth}
            strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}>
          {iconElement}
        </g>
      </svg>
    );
  }
}
