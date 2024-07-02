import React, { useState, useMemo } from "react";
import LineLabelSvg from "../../../clue/assets/icons/geometry/line-label.svg";
import { ELabelOption } from "../../../models/tiles/geometry/jxg-changes";
import { getPolygonEdge } from "../../../models/tiles/geometry/jxg-polygon";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import "./label-segment-dialog.scss";

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
  onAccept: (polygon: JXG.Polygon, points: [JXG.Point, JXG.Point], labelOption: ELabelOption) => void;
  onClose: () => void;
}
export const useLabelSegmentDialog = ({ board, polygon, points, onAccept, onClose }: IProps) => {
  const segment = useMemo(() => getPolygonSegment(board, polygon, points), [board, polygon, points]);
  const [initialLabelOption] = useState(segment?.getAttribute("clientLabelOption") || "none");
  const [labelOption, setLabelOption] = useState(initialLabelOption);

  const handleClick = () => {
    if (polygon && points && (initialLabelOption !== labelOption)) {
      onAccept(polygon, points, labelOption);
    } else {
      onClose();
    }
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: LineLabelSvg,
    title: "Segment Label",
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
