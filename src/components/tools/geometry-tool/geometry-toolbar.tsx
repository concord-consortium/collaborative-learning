import { observer } from "mobx-react";
import React from "react";
import { GeometryContentModelType } from "../../../models/tools/geometry/geometry-content";
import { isPoint } from "../../../models/tools/geometry/jxg-point";
import { canSupportVertexAngle, getVertexAngle } from "../../../models/tools/geometry/jxg-vertex-angle";
import { IToolbarActionHandlers } from "./geometry-shared";
import {
  AngleLabelButton, CommentButton, DeleteButton, DuplicateButton, MovableLineButton
} from "./geometry-tool-buttons";

interface IProps {
  board: JXG.Board;
  content: GeometryContentModelType;
  handlers: IToolbarActionHandlers;
}

export const GeometryToolbar: React.FC<IProps> = observer(({
  board, content, handlers
}) => {
  const {
    handleCreateComment, handleCreateMovableLine, handleDelete, handleDuplicate, handleToggleVertexAngle
  } = handlers;
  const selectedObjects = content.selectedObjects(board);
  const selectedPoints = selectedObjects && selectedObjects.filter(isPoint);
  const selectedPoint = selectedPoints && (selectedPoints.length === 1)
                          ? selectedPoints[0] as JXG.Point : undefined;
  const disableVertexAngle = !(selectedPoint && canSupportVertexAngle(selectedPoint));
  const hasVertexAngle = !!selectedPoint && !!getVertexAngle(selectedPoint);
  const disableDelete = !content.getDeletableSelectedIds(board).length;
  const disableDuplicate = (!content.getOneSelectedPoint(board) &&
                            !content.getOneSelectedPolygon(board));
  const disableComment = !content.getOneSelectedSegment(board) &&
                          !content.getCommentAnchor(board) &&
                          !content.getOneSelectedComment(board);
  return (
    <div className="geometry-toolbar" data-test="geometry-toolbar">
      <div className="toolbar-buttons">
        <DuplicateButton disabled={disableDuplicate} onClick={handleDuplicate}/>
        <AngleLabelButton disabled={disableVertexAngle} selected={hasVertexAngle} onClick={handleToggleVertexAngle}/>
        <MovableLineButton onClick={handleCreateMovableLine}/>
        <CommentButton disabled={disableComment} onClick={handleCreateComment}/>
        <DeleteButton disabled={disableDelete} onClick={handleDelete}/>
      </div>
    </div>
  );
});
