import classNames from "classnames";
import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { GeometryContentModelType } from "../../../models/tools/geometry/geometry-content";
import { isPoint } from "../../../models/tools/geometry/jxg-point";
import { canSupportVertexAngle, getVertexAngle } from "../../../models/tools/geometry/jxg-vertex-angle";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { IToolbarActionHandlers } from "./geometry-shared";
import {
  AngleLabelButton, CommentButton, DeleteButton, DuplicateButton, MovableLineButton
} from "./geometry-tool-buttons";
import { ImageUploadButton } from "../image/image-toolbar";

import "./geometry-toolbar.sass";

interface IProps extends IFloatingToolbarProps {
  board?: JXG.Board;
  content: GeometryContentModelType;
  handlers?: IToolbarActionHandlers;
}

export const GeometryToolbar: React.FC<IProps> = observer(({
  documentContent, toolTile, board, content, handlers, onIsEnabled, ...others
}) => {
  const {
    handleCreateComment, handleCreateMovableLine, handleDelete, handleDuplicate,
    handleToggleVertexAngle, handleUploadImageFile
  } = handlers || {};
  const enabled = onIsEnabled();
  const location = useFloatingToolbarLocation({
                    documentContent,
                    toolTile,
                    toolbarHeight: 38,
                    toolbarTopOffset: 2,
                    enabled,
                    ...others
                  });
  const selectedObjects = board && content.selectedObjects(board);
  const selectedPoints = selectedObjects?.filter(isPoint);
  const selectedPoint = selectedPoints?.length === 1 ? selectedPoints[0] as JXG.Point : undefined;
  const disableVertexAngle = !(selectedPoint && canSupportVertexAngle(selectedPoint));
  const hasVertexAngle = !!selectedPoint && !!getVertexAngle(selectedPoint);
  const disableDelete = board && !content.getDeletableSelectedIds(board).length;
  const disableDuplicate = board && (!content.getOneSelectedPoint(board) &&
                                    !content.getOneSelectedPolygon(board));
  const disableComment = board && !content.getOneSelectedSegment(board) &&
                                  !content.getCommentAnchor(board) &&
                                  !content.getOneSelectedComment(board);
  return documentContent
    ? ReactDOM.createPortal(
        <div className={classNames("geometry-toolbar", { disabled: !enabled || !location })}
              data-test="geometry-toolbar" style={location}
              onMouseDown={e => e.stopPropagation()}>
          <div className="toolbar-buttons">
            <DuplicateButton disabled={disableDuplicate} onClick={handleDuplicate}/>
            <AngleLabelButton disabled={disableVertexAngle} selected={hasVertexAngle}
                              onClick={handleToggleVertexAngle}/>
            <MovableLineButton onClick={handleCreateMovableLine}/>
            <CommentButton disabled={disableComment} onClick={handleCreateComment}/>
            <ImageUploadButton onUploadImageFile={handleUploadImageFile} tooltipOffset={{ y: 2 }}/>
            <DeleteButton disabled={disableDelete} onClick={handleDelete}/>
          </div>
        </div>, documentContent)
    : null;
});
