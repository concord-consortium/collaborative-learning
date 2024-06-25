import React, { useEffect } from "react";
import { ELabelOption } from "../../../models/tiles/geometry/jxg-changes";
import { useLabelPointDialog } from "./use-label-point-dialog";

interface IProps {
  board: JXG.Board;
  point: JXG.Point;
  onAccept: (point: JXG.Point, labelOption: ELabelOption, name: string, hasAngle: boolean) => void;
  onClose: () => void;
}

// Component wrapper for useLabelPointDialog() for use by class components.
const LabelPointDialog: React.FC<IProps> = ({
  board, point, onAccept, onClose
}: IProps) => {

  const [showDialog, hideDialog] = useLabelPointDialog({
    board,
    point,
    onAccept,
    onClose
  });

  useEffect(() => {
    showDialog();
    return () => hideDialog();
  }, [hideDialog, showDialog]);

  return null;
};
export default LabelPointDialog;
