import React, { useEffect } from "react";
import { useMovableLineDialog } from "./use-movable-line-dialog";

interface IProps {
  line: JXG.Line;
  onAccept: (line: JXG.Line, point1: [number, number], point2: [number, number]) => void;
  onClose: () => void;
}

// Component wrapper for useMovableLineDialog() for use by class components.
const MovableLineDialog: React.FC<IProps> = ({
  line, onAccept, onClose
}) => {

  const [showDialog, hideDialog] = useMovableLineDialog({
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
export default MovableLineDialog;
