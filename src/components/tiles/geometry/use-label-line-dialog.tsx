import React, { useState, useMemo } from "react";
import { ELabelOption } from "../../../models/tiles/geometry/jxg-changes";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { LabelRadioButton } from "./label-radio-button";
import { pointName } from "../../../models/tiles/geometry/jxg-point";
import { isPoint } from "../../../models/tiles/geometry/jxg-types";

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
          onChange={(e) => setName(e.target.value)} />
      </LabelRadioButton>
    </fieldset>
  );
};

function constructName(line: JXG.Line) {
  const points = Object.values(line.ancestors).filter(obj => isPoint(obj)) as JXG.Point[];
  return points.map(p => pointName(p)).join("");
}

interface IProps {
  board: JXG.Board;
  line: JXG.Line;
  onAccept: (line: JXG.Line, labelOption: ELabelOption, name: string) => void;
  onClose: () => void;
}
export const useLabelLineDialog = ({ board, line, onAccept, onClose }: IProps) => {
  const [initialLabelOption] = useState(line?.getAttribute("clientLabelOption") || "none");
  const [labelOption, setLabelOption] = useState(initialLabelOption);
  const [initialName] = useState(line?.getAttribute("clientName"));
  const defaultName = useMemo(() => constructName(line), [line]);
  const [name, setName] = useState(initialName || defaultName);

  const handleSubmit = () => {
    if (line && (initialLabelOption !== labelOption || initialName !== name)) {
      onAccept(line, labelOption, name);
    } else {
      onClose();
    }
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: LabelSvg,
    title: "Line Label",
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
