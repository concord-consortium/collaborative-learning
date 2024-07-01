import React, { useEffect } from "react";
import { ELabelOption } from "../../../models/tiles/geometry/jxg-changes";
import { useLabelSegmentDialog } from "./use-label-segment-dialog";

interface IProps {
  board: JXG.Board;
  polygon: JXG.Polygon;
  points: [JXG.Point, JXG.Point];
  onAccept: (polygon: JXG.Polygon, points: [JXG.Point, JXG.Point], labelOption: ELabelOption, name: string) => void;
  onClose: () => void;
}

// Component wrapper for useLabelSegmentDialog() for use by class components.
const LabelSegmentDialog: React.FC<IProps> = ({
  board, polygon, points, onAccept, onClose
}: IProps) => {

  const [showDialog, hideDialog] = useLabelSegmentDialog({
    board,
    polygon,
    points,
    onAccept,
    onClose
  });

  useEffect(() => {
    showDialog();
    return () => hideDialog();
  }, [hideDialog, showDialog]);

  return null;
};
export default LabelSegmentDialog;
