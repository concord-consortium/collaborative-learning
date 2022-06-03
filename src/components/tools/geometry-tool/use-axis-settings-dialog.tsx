import React, { useState } from "react";
import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import { useCurrent } from "../../../hooks/use-current";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { IAxesParams } from "../../../models/tools/geometry/geometry-content";
import { getAxisAnnotations, getBaseAxisLabels, guessUserDesiredBoundingBox
        } from "../../../models/tools/geometry/jxg-board";
import "./axis-settings-dialog.sass";

const kBoundsMaxChars = 6;
const kNameMaxChars = 20;
const kLabelMaxChars = 40;

// The complete dialog content
interface IContentProps {
  horizontalName: string;
  setHorizontalName: React.Dispatch<React.SetStateAction<string>>;
  verticalName: string;
  setVerticalName: React.Dispatch<React.SetStateAction<string>>;
  horizontalLabel: string;
  setHorizontalLabel: React.Dispatch<React.SetStateAction<string>>;
  verticalLabel: string;
  setVerticalLabel: React.Dispatch<React.SetStateAction<string>>;
  horizontalMin: string;
  setHorizontalMin: React.Dispatch<React.SetStateAction<string>>;
  verticalMin: string;
  setVerticalMin: React.Dispatch<React.SetStateAction<string>>;
  horizontalMax: string;
  setHorizontalMax: React.Dispatch<React.SetStateAction<string>>;
  verticalMax: string;
  setVerticalMax: React.Dispatch<React.SetStateAction<string>>;
  errorMessage: string;
}
const Content: React.FC<IContentProps> = ({
    horizontalName,
    setHorizontalName,
    verticalName,
    setVerticalName,
    horizontalLabel,
    setHorizontalLabel,
    verticalLabel,
    setVerticalLabel,
    horizontalMin,
    setHorizontalMin,
    verticalMin,
    setVerticalMin,
    horizontalMax,
    setHorizontalMax,
    verticalMax,
    setVerticalMax,
    errorMessage
  })=> {
    return (
      <>
        <AxisView
          title="Horizontal Axis"
          axisName={horizontalName}
          setName={setHorizontalName}
          label={horizontalLabel}
          setLabel={setHorizontalLabel}
          min={horizontalMin}
          setMin={setHorizontalMin}
          max={horizontalMax}
          setMax={setHorizontalMax}
        />
        <AxisView
          title="Vertical Axis"
          axisName={verticalName}
          setName={setVerticalName}
          label={verticalLabel}
          setLabel={setVerticalLabel}
          min={verticalMin}
          setMin={setVerticalMin}
          max={verticalMax}
          setMax={setVerticalMax}
        />
        <div className="nc-dialog-error">
          {errorMessage}
        </div>
      </>
    );
};

// Options for a single axis (included twice in the content)
interface axisViewProps {
  title: string;
  axisName: string; // Can't use just 'name'
  setName: React.Dispatch<React.SetStateAction<string>>;
  label: string;
  setLabel: React.Dispatch<React.SetStateAction<string>>;
  min: string;
  setMin: React.Dispatch<React.SetStateAction<string>>;
  max: string;
  setMax: React.Dispatch<React.SetStateAction<string>>;
}
const AxisView: React.FC<axisViewProps> = ({
  title,
  axisName,
  setName,
  label,
  setLabel,
  min,
  setMin,
  max,
  setMax
}: axisViewProps) => {
  return (
    <div className="axis-settings-container">
      <div className="axis-title">{title}</div>
      <div>
        <span className="nc-attribute-name-prompt label-padding">Label: </span>
        <span>
          <input
            className="nc-attribute-name-input pt-input input-margin"
            type="text"
            maxLength={kLabelMaxChars}
            defaultValue={label}
            onChange={e => setLabel(e.target.value)}
            dir="auto"
          />
        </span>
      </div>
      <div className="axis-options">
        <AxisOption
          optionLabel="Minimum Value:"
          defaultValue={min}
          setValue={setMin}
          maxChars={kBoundsMaxChars}
        />
        <AxisOption
          optionLabel="Maximum Value:"
          defaultValue={max}
          setValue={setMax}
          maxChars={kBoundsMaxChars}
        />
        <AxisOption
          optionLabel="Variable Name:"
          defaultValue={axisName}
          setValue={setName}
          maxChars={kNameMaxChars}
        />
      </div>
    </div>
  );
};

// A single axis option
interface axisOptionProps {
  optionLabel: string;
  defaultValue: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  maxChars: number;
}
const AxisOption: React.FC<axisOptionProps> = ({
  optionLabel, defaultValue, setValue, maxChars
}: axisOptionProps) => {
  return (
    <div className="axis-option">
      <div className="nc-attribute-name-prompt label-padding">{optionLabel}</div>
      <input
        className="nc-attribute-name-input pt-input input-margin"
        type="text"
        maxLength={maxChars}
        defaultValue={defaultValue}
        onChange={e => setValue(e.target.value)}
        dir="auto"
      />
    </div>
  );
};

interface IProps {
  board: JXG.Board;
  onAccept: (params: IAxesParams) => void;
  onClose: () => void;
}
export const useAxisSettingsDialog = ({ board, onAccept, onClose }: IProps) => {
  const [hName, vName] = getBaseAxisLabels(board);
  const [horizontalName, setHorizontalName] = useState(hName);
  const [verticalName, setVerticalName] = useState(vName);

  const [hLabel, vLabel] = getAxisAnnotations(board);
  const [horizontalLabel, setHorizontalLabel] = useState(hLabel);
  const [verticalLabel, setVerticalLabel] = useState(vLabel);

  const bBox = guessUserDesiredBoundingBox(board);
  const [horizontalMin, setHorizontalMin] = useState(JXG.toFixed(Math.min(0, bBox[0]), 1));
  const [verticalMax, setVerticalMax] = useState(JXG.toFixed(Math.max(0, bBox[1]), 1));
  const [horizontalMax, setHorizontalMax] = useState(JXG.toFixed(Math.max(0, bBox[2]), 1));
  const [verticalMin, setVerticalMin] = useState(JXG.toFixed(Math.min(0, bBox[3]), 1));

  const fHorizontalMin = useCurrent(parseFloat(horizontalMin));
  const fHorizontalMax = useCurrent(parseFloat(horizontalMax));
  const fVerticalMin = useCurrent(parseFloat(verticalMin));
  const fVerticalMax = useCurrent(parseFloat(verticalMax));
  const errorMessage =
    !isFinite(fHorizontalMin.current) || !isFinite(fHorizontalMax.current)
      || !isFinite(fVerticalMin.current) || !isFinite(fVerticalMax.current)
    ? "Please enter valid numbers for axis minimum and maximum values"
    : fHorizontalMin.current > 0 || fVerticalMin.current > 0
    ? "Axis minimum values must be less than or equal to 0."
    : fHorizontalMax.current < 0 || fVerticalMax.current < 0
    ? "Axis maximum values must be greater than or equal to 0."
    : fHorizontalMin.current >= fHorizontalMax.current
      || fVerticalMin.current >= fVerticalMax.current
    ? "Axis minimum values must be less than axis maximum values"
    : "";

  // We need to useCurrent on all parameters to onAccept() so it will work with keyboard submission
  const cHorizontalName = useCurrent(horizontalName);
  const cVerticalName = useCurrent(verticalName);
  const cHorizontalLabel = useCurrent(horizontalLabel);
  const cVerticalLabel = useCurrent(verticalLabel);
  const handleClick = () => {
    if (errorMessage.length === 0) {
      onAccept({
        xName: cHorizontalName.current,
        yName: cVerticalName.current,
        xAnnotation: cHorizontalLabel.current,
        yAnnotation: cVerticalLabel.current,
        xMax: fHorizontalMax.current,
        yMax: fVerticalMax.current,
        xMin: fHorizontalMin.current,
        yMin: fVerticalMin.current
      });
    } else {
      onClose();
    }
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: LinkGraphIcon,
    title: "Edit Axis",
    Content,
    contentProps: {
      horizontalName,
      setHorizontalName,
      verticalName,
      setVerticalName,
      horizontalLabel,
      setHorizontalLabel,
      verticalLabel,
      setVerticalLabel,
      horizontalMin,
      setHorizontalMin,
      verticalMin,
      setVerticalMin,
      horizontalMax,
      setHorizontalMax,
      verticalMax,
      setVerticalMax,
      errorMessage
    },
    buttons: [
      { label: "Cancel" },
      { label: "OK",
        isDefault: true,
        isDisabled: errorMessage.length > 0,
        onClick: handleClick
      }
    ],
    onClose
  }, [
    horizontalName,
    verticalName,
    horizontalLabel,
    verticalLabel,
    horizontalMin,
    verticalMin,
    horizontalMax,
    verticalMax,
    errorMessage
  ]);

  return [showModal, hideModal];
};
