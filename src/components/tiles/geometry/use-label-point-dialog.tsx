import React, { PropsWithChildren, useState } from "react";
import { ELabelOption } from "../../../models/tiles/geometry/jxg-changes";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { canSupportVertexAngle, getVertexAngle } from "../../../models/tiles/geometry/jxg-vertex-angle";

import LabelSvg from "../../../clue/assets/icons/shapes-label-value-icon.svg";

import "./label-dialog.scss";

interface LabelRadioButtonProps {
  display: string;
  label: string;
  checkedLabel: string;
  setLabelOption: React.Dispatch<React.SetStateAction<string>>;
}
const LabelRadioButton = function (
    {display, label, checkedLabel, setLabelOption, children}: PropsWithChildren<LabelRadioButtonProps>) {
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
      {children}
    </div>
  );
};

interface IContentProps {
  labelOption: string;
  setLabelOption: React.Dispatch<React.SetStateAction<string>>;
  pointName?: string;
  onNameChange: React.Dispatch<React.SetStateAction<string>>;
  supportsAngle: boolean;
  hasAngle: boolean;
  setHasAngle: React.Dispatch<React.SetStateAction<boolean>>;
}
const Content = function (
    { labelOption, setLabelOption, pointName, onNameChange, supportsAngle, hasAngle, setHasAngle }: IContentProps) {
  return (
    <fieldset className="radio-button-set">
      <LabelRadioButton
        display="None"
        label={ELabelOption.kNone}
        checkedLabel={labelOption}
        setLabelOption={setLabelOption}
      />
      <LabelRadioButton
        display="Label:"
        label={ELabelOption.kLabel}
        checkedLabel={labelOption}
        setLabelOption={setLabelOption}
      >
        <input type="text" className="name-input"
          disabled={labelOption !== ELabelOption.kLabel}
          value={pointName}
          onChange={(e) => { onNameChange(e.target.value); }} />
      </LabelRadioButton>
      <LabelRadioButton
        display="x, y coordinates"
        label={ELabelOption.kLength}
        checkedLabel={labelOption}
        setLabelOption={setLabelOption}
      />
      <div className="radio-button-container">
        <input
          id="angle-checkbox"
          type="checkbox"
          name="angle"
          className="checkbox"
          disabled={!supportsAngle}
          checked={hasAngle}
          onChange={(e) => setHasAngle(e.target.checked) }
        />
        <label htmlFor="angle-checkbox">Angle</label>
      </div>
    </fieldset>
  );
};

interface IProps {
  board: JXG.Board;
  point: JXG.Point;
  onAccept: (point: JXG.Point, labelOption: ELabelOption, name: string, hasAngle: boolean) => void;
  onClose: () => void;
}

export const useLabelPointDialog = ({ board, point, onAccept, onClose }: IProps) => {
  const [initialLabelOption] = useState(point.getAttribute("clientLabelOption") || ELabelOption.kNone);
  const [initialPointName] = useState(point.getAttribute("clientName") || "");
  const [labelOption, setLabelOption] = useState(initialLabelOption);
  const [pointName, setPointName] = useState(initialPointName);
  const supportsAngle = canSupportVertexAngle(point);
  const [initialHasAngle] = useState(!!getVertexAngle(point));
  const [hasAngle, setHasAngle] = useState(initialHasAngle);

  const handleSubmit = () => {
    if (initialLabelOption !== labelOption || initialPointName !== pointName || initialHasAngle !== hasAngle) {
      onAccept(point, labelOption, pointName, hasAngle);
    } else {
      onClose();
    }
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: LabelSvg,
    title: "Point Label/Value",
    Content,
    contentProps:
      { labelOption, setLabelOption, pointName, onNameChange: setPointName, supportsAngle, hasAngle, setHasAngle },
    buttons: [
      { label: "Cancel" },
      { label: "OK",
        isDefault: true,
        isDisabled: false,
        onClick: handleSubmit
      }
    ],
    onClose
  }, [labelOption, pointName, hasAngle]);

  return [showModal, hideModal];
};
