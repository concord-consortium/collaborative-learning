import React, { useEffect } from "react";
import { IAxesParams } from "../../../models/tools/geometry/geometry-content";
import { useAxisSettingsDialog } from "./use-axis-settings-dialog";

interface IProps {
  board: JXG.Board;
  onAccept: (params: IAxesParams) => void;
  onClose: () => void;
}

// Component wrapper for useAxisSettingsDialog() for use by class components.
const AxisSettingsDialog: React.FC<IProps> = ({
  board, onAccept, onClose
}: IProps) => {

  const [showDialog, hideDialog] = useAxisSettingsDialog({
    board,
    onAccept,
    onClose
  });

  useEffect(() => {
    showDialog();
    return () => hideDialog();
  }, [hideDialog, showDialog]);

  return null;
};
export default AxisSettingsDialog;
