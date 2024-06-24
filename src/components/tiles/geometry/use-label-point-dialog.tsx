import React, { useState } from "react";
import { ELabelOption } from "../../../models/tiles/geometry/jxg-changes";
import { useCustomModal } from "../../../hooks/use-custom-modal";

import LabelSvg from "../../../clue/assets/icons/shapes-label-value-icon.svg";

import "./label-dialog.scss";

interface LabelRadioButtonProps {
  display: string;
  label: string;
  checkedLabel: string;
  setLabelOption: React.Dispatch<React.SetStateAction<string>>;
}
const LabelRadioButton: React.FC<LabelRadioButtonProps> = ({display, label, checkedLabel, setLabelOption}) => {
  return (
    <div className="radio-button-container">
      <input
        className="radio-button"
        type="radio"
        id={label}
        name="labelOption"
        value={label}
        checked={label === checkedLabel}
        onChange={e => {
          if (e.target.checked) {
            setLabelOption(e.target.value);
          }
        }}
      />
      <label htmlFor={label}>
        {display}
      </label>
    </div>
  );
};

interface IContentProps {
  labelOption: string;
  setLabelOption: React.Dispatch<React.SetStateAction<string>>;
}
const Content: React.FC<IContentProps> = ({ labelOption, setLabelOption }) => {
  return (
    <fieldset className="radio-button-set">
      <LabelRadioButton
        display="None"
        label={ELabelOption.kNone}
        checkedLabel={labelOption}
        setLabelOption={setLabelOption}
      />
      <LabelRadioButton
        display="Label"
        label={ELabelOption.kLabel}
        checkedLabel={labelOption}
        setLabelOption={setLabelOption}
      />
      <LabelRadioButton
        display="x, y coordinates"
        label={ELabelOption.kMeasure}
        checkedLabel={labelOption}
        setLabelOption={setLabelOption}
      />
    </fieldset>
  );
};

interface IProps {
  board: JXG.Board;
  point: JXG.Point;
  onAccept: (point: JXG.Point, labelOption: ELabelOption) => void;
  onClose: () => void;
}

export const useLabelPointDialog = ({ board, point, onAccept, onClose }: IProps) => {
  const [initialLabelOption] = useState(point.getAttribute("clientLabelOption") || ELabelOption.kNone);
  const [labelOption, setLabelOption] = useState(initialLabelOption);

  const handleClick = () => {
    if (initialLabelOption !== labelOption) {
      onAccept(point, labelOption);
    } else {
      onClose();
    }
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: LabelSvg,
    title: "Point Label/Value",
    Content,
    contentProps: { labelOption, setLabelOption },
    buttons: [
      { label: "Cancel" },
      { label: "OK",
        isDefault: true,
        isDisabled: false,
        onClick: handleClick
      }
    ],
    onClose
  }, [labelOption]);

  return [showModal, hideModal];
};
