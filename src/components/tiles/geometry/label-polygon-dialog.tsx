import React, { useEffect } from "react";
import { ELabelOption } from "../../../models/tiles/geometry/jxg-changes";
import { useLabelPolygonDialog } from "./use-label-polygon-dialog";

interface IProps {
  board: JXG.Board;
  polygon: JXG.Polygon;
  onAccept: (polygon: JXG.Polygon, labelOption: ELabelOption, name: string) => void;
  onClose: () => void;
}

// Component wrapper for useLabelPolygonDialog() for use by class components.
const LabelPolygonDialog: React.FC<IProps> = ({
  board, polygon, onAccept, onClose
}: IProps) => {

  const [showDialog, hideDialog] = useLabelPolygonDialog({
    board,
    polygon,
    onAccept,
    onClose
  });

  useEffect(() => {
    showDialog();
    return () => hideDialog();
  }, [hideDialog, showDialog]);

  return null;
};
export default LabelPolygonDialog;
