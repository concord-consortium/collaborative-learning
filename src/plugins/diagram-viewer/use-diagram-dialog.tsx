import React from "react";
import VariablesIcon from "./shared-variables/slate/variables.svg";
import { useCustomModal } from "../../hooks/use-custom-modal";

import './movable-line-dialog.scss';
import './dialog.scss';

interface IContentProps {
  message: string;
}
const Content = ({ message }: IContentProps) => {
  return (
    <div>
      { message }
    </div>
  );
};

interface IProps {
  onAccept: () => void;
  onClose: () => void;
}
export const useMovableLineDialog = ({ onAccept, onClose }: IProps) => {

  const handleClick = () => {
    onAccept();
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: VariablesIcon,
    title: "Diagram Variables",
    Content,
    contentProps: { message: "One day, I'll be a real dialog!" },
    buttons: [
      { label: "Cancel" },
      { label: "OK",
        isDefault: true,
        isDisabled: false,
        onClick: handleClick
      }
    ],
    onClose
  }, []);

  return [showModal, hideModal];
};
