import * as React from "react";
import { SizeMe } from "react-sizeme";
import { observer } from "mobx-react";
import { GeometryToolbarView } from "./geometry-toolbar";
import { GeometryContentComponent } from "./geometry-content";
import { IGeometryProps, IToolButtonHandlers, SizeMeProps } from "./geometry-shared";
import { GeometryContentModelType } from "../../../models/tools/geometry/geometry-content";
import { isPoint } from "../../../models/tools/geometry/jxg-point";
import { canSupportVertexAngle, getVertexAngle } from "../../../models/tools/geometry/jxg-vertex-angle";

import "./geometry-tool.sass";

interface IState {
  board?: JXG.Board;
  handlers?: IToolButtonHandlers;
}

@observer
export default class GeometryToolComponent extends React.Component<IGeometryProps, IState> {

  public static getDragImageNode(dragTargetNode: HTMLElement) {
    // dragTargetNode is the tool-tile div
    const geometryElts = dragTargetNode.getElementsByClassName("geometry-tool");
    const geometryElt = geometryElts && geometryElts[0];
    // geometryElt's firstChild is the actual SVG, which works as a drag image
    return geometryElt && geometryElt.firstChild;
  }

  public state: IState = {};

  public render() {
    return (
      <div className="geometry-tool">
        {this.renderToolbar()}
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
    const disableDelete = readOnly || !board || !content.hasSelection();
    const disableDuplicate = readOnly || !board || !content.getOneSelectedPolygon(board);

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
      />
    );
  }

  private renderContent() {
    return (
      <div className="geometry-wrapper">
        <SizeMe monitorHeight={true}>
          {({ size }: SizeMeProps) => {
            return (
              <div className="geometry-size-me">
                <GeometryContentComponent
                  size={size}
                  onSetBoard={this.handleSetBoard}
                  onSetToolButtonHandlers={this.handleSetToolButtonHandlers}
                  {...this.props} />
              </div>
            );
          }}
        </SizeMe>
      </div>
    );
  }

  private handleSetBoard = (board: JXG.Board) => {
    this.setState({ board });
  }

  private handleSetToolButtonHandlers = (handlers: IToolButtonHandlers) => {
    this.setState({ handlers });
  }
}
