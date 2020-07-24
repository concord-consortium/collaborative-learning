import React from "react";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../../base";
import { GeometryToolbarView } from "./geometry-toolbar";
import { GeometryContentComponent } from "./geometry-content";
import { IGeometryProps, IActionHandlers } from "./geometry-shared";
import { GeometryContentModelType } from "../../../models/tools/geometry/geometry-content";
import { isPoint } from "../../../models/tools/geometry/jxg-point";
import { canSupportVertexAngle, getVertexAngle } from "../../../models/tools/geometry/jxg-vertex-angle";
import { HotKeys } from "../../../utilities/hot-keys";
import classNames from "classnames";
import { hasSelectionModifier } from "../../../utilities/event-utils";

import "./geometry-tool.sass";

interface IState {
  board?: JXG.Board;
  handlers?: IActionHandlers;
}

@inject("stores")
@observer
export default class GeometryToolComponent extends BaseComponent<IGeometryProps, IState> {

  public static getDragImageNode(dragTargetNode: HTMLElement) {
    // dragTargetNode is the tool-tile div
    const geometryElts = dragTargetNode.getElementsByClassName("geometry-content");
    const geometryElt = geometryElts && geometryElts[0];
    // geometryElt's firstChild is the actual SVG, which works as a drag image
    return geometryElt && geometryElt.firstChild;
  }

  public state: IState = {};

  private domElement: React.RefObject<HTMLDivElement> = React.createRef();
  private hotKeys: HotKeys = new HotKeys();
  private didLastMouseDownSelectTile = false;

  public render() {
    // We must listen for pointer events because we want to get the events before
    // JSXGraph, which appears to listen to pointer events on browsers that support them.
    // We must listen for mouse events because some browsers (notably Safari) don't
    // support pointer events.
    return (
      <div className="geometry-tool" ref={this.domElement}
          tabIndex={0} onKeyDown={this.handleKeyDown}
          onPointerDownCapture={this.handlePointerDownCapture}
          onPointerUpCapture={this.handlePointerUpCapture}
          onMouseDownCapture={this.handlePointerDownCapture}
          onMouseUpCapture={this.handlePointerUpCapture} >
        {!this.props.readOnly ? this.renderToolbar() : null}
        {this.renderContent()}
      </div>
    );
  }

  private getContent() {
    return this.props.model.content as GeometryContentModelType;
  }

  private renderToolbar() {
    const { board, handlers } = this.state;
    if (!board || !handlers) return;
    const { readOnly } = this.props;
    const content = this.getContent();

    const selectedObjects = this.getContent().selectedObjects(board);
    const selectedPoints = selectedObjects && selectedObjects.filter(isPoint);
    const selectedPoint = selectedPoints && (selectedPoints.length === 1)
                            ? selectedPoints[0] as JXG.Point : undefined;
    const supportsVertexAngle = selectedPoint && canSupportVertexAngle(selectedPoint);
    const hasVertexAngle = !!selectedPoint && !!getVertexAngle(selectedPoint);
    const disableVertexAngle = readOnly || !supportsVertexAngle;
    const disableDelete = readOnly || !board || !content.getDeletableSelectedIds(board).length;
    const disableDuplicate = readOnly || !board ||
                              (!content.getOneSelectedPoint(board) &&
                                !content.getOneSelectedPolygon(board));
    const disableComment = !content.getOneSelectedSegment(board) &&
                            !content.getCommentAnchor(board) &&
                            !content.getOneSelectedComment(board);

    return (
      <GeometryToolbarView
        key="geometry-toolbar-view"
        model={this.props.model}
        onAngleLabelClick={handlers.handleToggleVertexAngle}
        isAngleLabelDisabled={disableVertexAngle}
        isAngleLabelSelected={hasVertexAngle}
        onDeleteClick={handlers.handleDelete}
        isDeleteDisabled={disableDelete}
        onDuplicateClick={handlers.handleDuplicate}
        isDuplicateDisabled={disableDuplicate}
        onMovableLineClick={handlers.handleCreateMovableLine}
        onCommentClick={handlers.handleCreateComment}
        isCommentDisabled={disableComment}
      />
    );
  }

  private renderContent() {
    return (
      <div className={classNames("geometry-wrapper", { "read-only": this.props.readOnly })}>
        <SizeMe monitorHeight={true}>
          {({ size }: SizeMeProps) => {
            return (
              <div className="geometry-size-me">
                <GeometryContentComponent
                  size={size}
                  onSetBoard={this.handleSetBoard}
                  onSetActionHandlers={this.handleSetActionHandlers}
                  onUpdateToolbar={this.handleUpdateToolbar}
                  {...this.props} />
              </div>
            );
          }}
        </SizeMe>
      </div>
    );
  }

  private handleUpdateToolbar = () => {
    this.forceUpdate();
  }

  private handlePointerDownCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    const { ui } = this.stores;
    const { model } = this.props;

    // clicked tile gets keyboard focus
    if (this.domElement.current) {
      // requires non-empty tabIndex
      this.domElement.current.focus();
    }
    // first click selects the tile
    if (!ui.isSelectedTile(model)) {
      ui.setSelectedTile(model, {append: hasSelectionModifier(e)});
      this.didLastMouseDownSelectTile = true;
      // prevent the click from taking effect, e.g. creating a point
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private handlePointerUpCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (this.didLastMouseDownSelectTile) {
      this.didLastMouseDownSelectTile = false;
      // prevent the click from taking effect, e.g. creating a point
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    this.hotKeys.dispatch(e);
  }

  private handleSetBoard = (board: JXG.Board) => {
    this.setState({ board });
  }

  private handleSetActionHandlers = (handlers: IActionHandlers) => {
    this.setState({ handlers }, () => {
      this.hotKeys.register({
        "left": handlers.handleArrows,
        "up": handlers.handleArrows,
        "right": handlers.handleArrows,
        "down":  handlers.handleArrows,
        "backspace": handlers.handleDelete,
        "delete": handlers.handleDelete,
        "cmd-c": handlers.handleCopy,
        "cmd-x": handlers.handleCut,
        "cmd-v": handlers.handlePaste,
        "cmd-z": handlers.handleUndo,
        "cmd-shift-z": handlers.handleRedo,
      });
    });
  }
}
