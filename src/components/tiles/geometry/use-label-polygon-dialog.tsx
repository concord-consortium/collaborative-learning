import React, { useState } from "react";
import { ELabelOption } from "../../../models/tiles/geometry/jxg-changes";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { LabelRadioButton } from "./label-radio-button";
import { pointName } from "../../../models/tiles/geometry/jxg-point";

import LabelSvg from "../../../clue/assets/icons/shapes-label-value-icon.svg";

import "./label-dialog.scss";

interface IContentProps {
  labelOption: string;
  setLabelOption: React.Dispatch<React.SetStateAction<string>>;
  name?: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
}
const Content: React.FC<IContentProps> = (
  { labelOption, setLabelOption, name, setName }) => {
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
          value={name}
          onChange={(e) => { setName(e.target.value); }} />
      </LabelRadioButton>
      <LabelRadioButton
        display="Area"
        label={ELabelOption.kLength}
        checkedLabel={labelOption}
        setLabelOption={setLabelOption}
      />
    </fieldset>
  );
};

function constructName(polygon: JXG.Polygon) {
  return polygon.vertices.slice(0, -1)
    .reduce((name: string, point) => { return name + pointName(point); }, "");
}

interface IProps {
  board: JXG.Board;
  polygon: JXG.Polygon;
  onAccept: (polygon: JXG.Polygon, labelOption: ELabelOption, name: string) => void;
  onClose: () => void;
}
export const useLabelPolygonDialog = ({ board, polygon, onAccept, onClose }: IProps) => {
  const [initialLabelOption] = useState(polygon?.getAttribute("clientLabelOption") || "none");
  const [labelOption, setLabelOption] = useState(initialLabelOption);
  const [initialName] = useState(polygon?.getAttribute("clientName"));
  const [name, setName] = useState(initialName || constructName(polygon));

  const handleSubmit = () => {
    if (polygon && (initialLabelOption !== labelOption || initialName !== name)) {
      onAccept(polygon, labelOption, name);
    } else {
      onClose();
    }
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: LabelSvg,
    title: "Polygon Label/Value",
    Content,
    contentProps: { labelOption, setLabelOption, name, setName },
    buttons: [
      { label: "Cancel" },
      { label: "OK",
        isDefault: true,
        isDisabled: false,
        onClick: handleSubmit
      }
    ],
    onClose
  }, [labelOption, name]);

  return [showModal, hideModal];
};
