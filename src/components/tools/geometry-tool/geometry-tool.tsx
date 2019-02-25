import * as React from "react";
import { SizeMe } from "react-sizeme";
import { observer } from "mobx-react";
import { GeometryToolbarView } from "./geometry-toolbar";
import { GeometryContentComponent } from "./geometry-content";
import { IGeometryProps, IActionHandlers, SizeMeProps } from "./geometry-shared";
import { GeometryContentModelType } from "../../../models/tools/geometry/geometry-content";
import { isPoint } from "../../../models/tools/geometry/jxg-point";
import { canSupportVertexAngle, getVertexAngle } from "../../../models/tools/geometry/jxg-vertex-angle";
import { HotKeys } from "../../../utilities/hot-keys";
import * as classNames from "classnames";

import "./geometry-tool.sass";

interface IState {
  board?: JXG.Board;
  handlers?: IActionHandlers;
}

@observer
export default class GeometryToolComponent extends React.Component<IGeometryProps, IState> {

  public static getDragImageNode(dragTargetNode: HTMLElement) {
    // dragTargetNode is the tool-tile div
    const geometryElts = dragTargetNode.getElementsByClassName("geometry-content");
    const geometryElt = geometryElts && geometryElts[0];
    // geometryElt's firstChild is the actual SVG, which works as a drag image
    return geometryElt && geometryElt.firstChild;
  }

  public state: IState = {};

  private hotKeys: HotKeys = new HotKeys();

  public render() {
    return (
      <div className="geometry-tool" tabIndex={0} onKeyDown={this.handleKeyDown} >
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
    const disableDuplicate = readOnly || !board || !content.getOneSelectedPolygon(board);
    const disableComment = !content.getCommentAnchor(board) &&
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
                  {...this.props} />
              </div>
            );
          }}
        </SizeMe>
      </div>
    );
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
