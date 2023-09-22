import React, { useState } from "react";
import { round } from "lodash";
import MovableLineSvg from "../../../clue/assets/icons/geometry/movable-line.svg";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { getBoundingBoxIntersections, solveForY } from "../../../models/tiles/geometry/jxg-movable-line";
import './movable-line-dialog.scss';
import './dialog.scss';

interface LineOptionProps {
  display: string;
  id: string;
  defaultValue: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
}
const LineOption: React.FC<LineOptionProps> = ({ display, id, defaultValue, setValue }) => {
  return (
    <div className="movable-line-option">
      <label className="dialog-label" htmlFor={id}>{display}</label>
      <input
        className="dialog-name-input pt-input"
        id={id}
        type="text"
        maxLength={5}
        defaultValue={defaultValue}
        onChange={e => setValue(e.target.value)}
        dir="auto"
      />
    </div>
  );
};

interface IContentProps {
  slope: string;
  setSlope: React.Dispatch<React.SetStateAction<string>>;
  intercept: string;
  setIntercept: React.Dispatch<React.SetStateAction<string>>;
  errorMessage: string;
}
const Content: React.FC<IContentProps> = ({ slope, setSlope, intercept, setIntercept, errorMessage }) => {
  return (
    <div className="movable-line-dialog-content">
      <LineOption
        display="Slope:"
        id="slopeInput"
        defaultValue={slope}
        setValue={setSlope}
      />
      <LineOption
        display="y-intercept:"
        id="yinterceptInput"
        defaultValue={intercept}
        setValue={setIntercept}
      />
      <div className="dialog-error-message double-line">
        {errorMessage}
      </div>
    </div>
  );
};

interface IProps {
  line: JXG.Line;
  onAccept: (line: JXG.Line, point1: [number, number], point2: [number, number]) => void;
  onClose: () => void;
}
export const useMovableLineDialog = ({ line, onAccept, onClose }: IProps) => {
  const [slope, setSlope] = useState(`${round(line.getSlope(), 1)}`);
  const [intercept, setIntercept] = useState(`${round(line.getRise(), 1)}`);

  const fSlope = parseFloat(slope);
  const fIntercept = parseFloat(intercept);
  const errorMessage = (!isFinite(fSlope) || !isFinite(fIntercept))
                        ? "Please enter a valid number for slope and intercept."
                        : getBoundingBoxIntersections(fSlope, fIntercept, line.board).length < 2
                          ? "Please change the graph axes scale to make the line visible, and try again."
                          : "";

  const getLineControlPoints = () => {
    if (isFinite(fSlope) && isFinite(fIntercept)) {
      const board = line.board;
      const intersections = getBoundingBoxIntersections(fSlope, fIntercept, board);
      if (!intersections.length) return undefined;
      let point1: [number, number];
      let point2: [number, number];
      if (board.hasPoint(0, fIntercept)) {
        point1 = [0, fIntercept];
        const maxX = intersections[1][0];
        const middleX = maxX / 2;
        point2 = [middleX, solveForY(fSlope, fIntercept, middleX)];
      } else {
        const minX = intersections[0][0];
        const maxX = intersections[1][0];
        const lineWidth = maxX - minX;
        const thirdLineWidth = lineWidth / 3;
        const x1 = minX + thirdLineWidth;
        const x2 = minX + thirdLineWidth * 2;
        point1 = [x1, solveForY(fSlope, fIntercept, x1)];
        point2 = [x2, solveForY(fSlope, fIntercept, x2)];
      }
      return [point1, point2];
    } else {
      return undefined;
    }
  };

  const handleClick = () => {
    const points = getLineControlPoints();
    if (points) {
      onAccept(line, points[0], points[1]);
    } else {
      onClose();
    }
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: MovableLineSvg,
    title: "Movable Line",
    Content,
    contentProps: { slope, setSlope, intercept, setIntercept, errorMessage },
    buttons: [
      { label: "Cancel" },
      { label: "OK",
        isDefault: true,
        isDisabled: errorMessage.length > 0,
        onClick: handleClick
      }
    ],
    onClose
  }, [slope, intercept, errorMessage]);

  return [showModal, hideModal];
};
