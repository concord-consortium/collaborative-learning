import React, { useState, useMemo } from "react";
import { ELabelOption } from "../../../models/tiles/geometry/jxg-changes";
import { getPolygonEdge } from "../../../models/tiles/geometry/jxg-polygon";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { LabelRadioButton } from "./label-radio-button";

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
        display="Length"
        label={ELabelOption.kLength}
        checkedLabel={labelOption}
        setLabelOption={setLabelOption}
      />
    </fieldset>
  );
};

function getPolygonSegment(board: JXG.Board, polygon: JXG.Polygon, points: [JXG.Point, JXG.Point]) {
  const pointIds = points.map(pt => pt.id);
  return getPolygonEdge(board, polygon.id, pointIds);
}

interface IProps {
  board: JXG.Board;
  polygon: JXG.Polygon;
  points: [JXG.Point, JXG.Point];
  onAccept: (polygon: JXG.Polygon, points: [JXG.Point, JXG.Point], labelOption: ELabelOption, name: string) => void;
  onClose: () => void;
}
export const useLabelSegmentDialog = ({ board, polygon, points, onAccept, onClose }: IProps) => {
  const segment = useMemo(() => getPolygonSegment(board, polygon, points), [board, polygon, points]);
  const [initialLabelOption] = useState(segment?.getAttribute("clientLabelOption") || "none");
  const [labelOption, setLabelOption] = useState(initialLabelOption);
  const [initialName] = useState(segment?.getAttribute("clientOriginalName") || "");
  const [name, setName] = useState(initialName);

  const handleSubmit = () => {
    if (polygon && points && (initialLabelOption !== labelOption)) {
      onAccept(polygon, points, labelOption, name);
    } else {
      onClose();
    }
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: LabelSvg,
    title: "Segment Label/Value",
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
