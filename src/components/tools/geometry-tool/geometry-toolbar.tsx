import React from "react";
import {
  AngleLabelButton, CommentButton, DeleteButton, DuplicateButton, IClientToolButtonProps, MovableLineButton
} from "./geometry-tool-buttons";

interface IProps {
  duplicate: IClientToolButtonProps;
  angleLabel: IClientToolButtonProps;
  movableLine: IClientToolButtonProps;
  comment: IClientToolButtonProps;
  trash: IClientToolButtonProps;
}

export const GeometryToolbar: React.FC<IProps> = ({
  duplicate, angleLabel, movableLine, comment, trash
}) => {
  return (
    <div className="geometry-toolbar" data-test="geometry-toolbar">
      <div className="toolbar-buttons">
        <DuplicateButton {...duplicate} />
        <AngleLabelButton {...angleLabel} />
        <MovableLineButton {...movableLine} />
        <CommentButton {...comment} />
        <DeleteButton {...trash} />
      </div>
    </div>
  );
};
