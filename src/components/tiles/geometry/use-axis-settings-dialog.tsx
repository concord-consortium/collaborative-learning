import React, { useState } from "react";
import GeometryToolIcon from "../../../clue/assets/icons/geometry-tool.svg";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { IAxesParams } from "../../../models/tiles/geometry/geometry-content";
import { getAxisAnnotations, getBaseAxisLabels, guessUserDesiredBoundingBox
        } from "../../../models/tiles/geometry/jxg-board";
import "./axis-settings-dialog.scss";
import "./dialog.scss";

const kBoundsMaxChars = 6;
const kNameMaxChars = 20;
const kLabelMaxChars = 40;

// The complete dialog content
interface IContentProps {
  xName: string;
  setXName: React.Dispatch<React.SetStateAction<string>>;
  yName: string;
  setYName: React.Dispatch<React.SetStateAction<string>>;
  xLabel: string;
  setXLabel: React.Dispatch<React.SetStateAction<string>>;
  yLabel: string;
  setYLabel: React.Dispatch<React.SetStateAction<string>>;
  xMin: string;
  setXMin: React.Dispatch<React.SetStateAction<string>>;
  yMin: string;
  setYMin: React.Dispatch<React.SetStateAction<string>>;
  xMax: string;
  setXMax: React.Dispatch<React.SetStateAction<string>>;
  yMax: string;
  setYMax: React.Dispatch<React.SetStateAction<string>>;
  errorMessage: string;
}
const Content: React.FC<IContentProps> = ({
    xName, setXName, yName, setYName,
    xLabel, setXLabel, yLabel, setYLabel,
    xMin, setXMin, yMin, setYMin,
    xMax, setXMax, yMax, setYMax,
    errorMessage
  })=> {
    return (
      <>
        <AxisView
          title="Horizontal Axis"
          axisName={xName}
          setName={setXName}
          label={xLabel}
          setLabel={setXLabel}
          min={xMin}
          setMin={setXMin}
          max={xMax}
          setMax={setXMax}
        />
        <AxisView
          title="Vertical Axis"
          axisName={yName}
          setName={setYName}
          label={yLabel}
          setLabel={setYLabel}
          min={yMin}
          setMin={setYMin}
          max={yMax}
          setMax={setYMax}
        />
        <div className="dialog-error-message single-line">
          {errorMessage}
        </div>
      </>
    );
};

// Options for a single axis (included twice in the content)
interface axisViewProps {
  title: string;
  axisName: string; // Can't use just 'name' because it's a built-in javascript property
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
  axisName, setName,
  label, setLabel,
  min, setMin,
  max, setMax
}: axisViewProps) => {
  const labelId = `${title}-label-input-id`;
  return (
    <div className="axis-settings-container">
      <div className="axis-title">{title}</div>
      <div>
        <label
          className="axis-settings-label"
          htmlFor={labelId}
        >
          Label:
        </label>
        <input
          className="dialog-name-input pt-input input-margin"
          id={labelId}
          type="text"
          maxLength={kLabelMaxChars}
          defaultValue={label}
          onChange={e => setLabel(e.target.value)}
          dir="auto"
        />
      </div>
      <div className="axis-options">
        <AxisOption
          axis={title}
          optionLabel="Minimum Value:"
          defaultValue={min}
          setValue={setMin}
          maxChars={kBoundsMaxChars}
        />
        <AxisOption
          axis={title}
          optionLabel="Maximum Value:"
          defaultValue={max}
          setValue={setMax}
          maxChars={kBoundsMaxChars}
        />
        <AxisOption
          axis={title}
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
  axis: string;
  optionLabel: string;
  defaultValue: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  maxChars: number;
}
const AxisOption: React.FC<axisOptionProps> = ({
  axis, optionLabel, defaultValue, setValue, maxChars
}: axisOptionProps) => {
  const id = `${axis}-${optionLabel}-input-id`;
  return (
    <div className="axis-option">
      <label className="axis-settings-label" htmlFor={id}>{optionLabel}</label>
      <input
        className="dialog-name-input pt-input input-margin"
        id={id}
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
  const [xName, setXName] = useState(hName);
  const [yName, setYName] = useState(vName);

  const [hLabel, vLabel] = getAxisAnnotations(board);
  const [xLabel, setXLabel] = useState(hLabel);
  const [yLabel, setYLabel] = useState(vLabel);

  const bBox = guessUserDesiredBoundingBox(board);
  const [xMin, setXMin] = useState(JXG.toFixed(Math.min(0, bBox[0]), 1));
  const [yMax, setYMax] = useState(JXG.toFixed(Math.max(0, bBox[1]), 1));
  const [xMax, setXMax] = useState(JXG.toFixed(Math.max(0, bBox[2]), 1));
  const [yMin, setYMin] = useState(JXG.toFixed(Math.min(0, bBox[3]), 1));

  const fXMin = parseFloat(xMin);
  const fXMax = parseFloat(xMax);
  const fYMin = parseFloat(yMin);
  const fYMax = parseFloat(yMax);
  const errorMessage =
    !isFinite(fXMin) || !isFinite(fXMax) || !isFinite(fYMin) || !isFinite(fYMax)
    ? "Please enter valid numbers for axis minimum and maximum values"
    : fXMin > 0 || fYMin > 0
    ? "Axis minimum values must be less than or equal to 0."
    : fXMax < 0 || fYMax < 0
    ? "Axis maximum values must be greater than or equal to 0."
    : fXMin >= fXMax || fYMin >= fYMax
    ? "Axis minimum values must be less than axis maximum values"
    : "";

  const handleClick = () => {
    if (errorMessage.length === 0) {
      onAccept({
        xName,
        yName,
        xAnnotation: xLabel,
        yAnnotation: yLabel,
        xMax: fXMax,
        yMax: fYMax,
        xMin: fXMin,
        yMin: fYMin
      });
    } else {
      onClose();
    }
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: GeometryToolIcon,
    title: "Axis Settings",
    Content,
    contentProps: {
      xName, setXName, yName, setYName,
      xLabel, setXLabel, yLabel, setYLabel,
      xMin, setXMin, yMin, setYMin,
      xMax, setXMax, yMax, setYMax,
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
  }, [xName, yName, xLabel, yLabel, xMin, yMin, xMax, yMax, errorMessage]);

  return [showModal, hideModal];
};
