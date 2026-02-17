import React, { useEffect } from "react";
import { ELabelOption } from "../../../models/tiles/geometry/jxg-changes";
import { useLabelLineDialog } from "./use-label-line-dialog";

interface IProps {
  board: JXG.Board;
  line: JXG.Line;
  onAccept: (line: JXG.Line, labelOption: ELabelOption, name: string) => void;
  onClose: () => void;
}

// Component wrapper for useLabelLineDialog() for use by class components.
const LabelLineDialog: React.FC<IProps> = ({
  board, line, onAccept, onClose
}: IProps) => {

  const [showDialog, hideDialog] = useLabelLineDialog({
    board,
    line,
    onAccept,
    onClose
  });

  useEffect(() => {
    showDialog();
    return () => hideDialog();
  }, [hideDialog, showDialog]);

  return null;
};
export default LabelLineDialog;
