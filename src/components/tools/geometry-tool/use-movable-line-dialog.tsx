import React, { useState } from "react";
import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import { useCurrent } from "../../../hooks/use-current";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { getBoundingBoxIntersections, solveForY } from "../../../models/tools/geometry/jxg-movable-line";
import { round } from "lodash";

interface IContentProps {
  slope: string;
  setSlope: React.Dispatch<React.SetStateAction<string>>;
  intercept: string;
  setIntercept: React.Dispatch<React.SetStateAction<string>>;
  errorMessage: string;
}
const Content: React.FC<IContentProps> = ({ slope, setSlope, intercept, setIntercept, errorMessage }) => {
  return (
    <>
      <div className="nc-attribute-name-prompt">Slope:</div>
      <input
        className="nc-attribute-name-input pt-input"
        type="text"
        maxLength={5}
        defaultValue={slope}
        onChange={e => setSlope(e.target.value)}
        // onKeyDown={handleKeyDown}
        dir="auto"
      />
      <div className="nc-attribute-name-prompt">y-intercept:</div>
      <input
        className="nc-attribute-name-input pt-input"
        type="text"
        maxLength={5}
        defaultValue={intercept}
        onChange={e => setIntercept(e.target.value)}
        // onKeyDown={handleKeyDown}
        dir="auto"
      />
      <div className="nc-dialog-error">
        {errorMessage}
      </div>
    </>
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

  const fSlope = useCurrent(parseFloat(slope));
  const fIntercept = useCurrent(parseFloat(intercept));
  const errorMessage = (!isFinite(fSlope.current) || !isFinite(fIntercept.current))
                        ? "Please enter a valid number for slope and intercept."
                        : getBoundingBoxIntersections(fSlope.current, fIntercept.current, line.board).length < 2
                          ? "Please change the graph axes scale to make the line visible, and try again."
                          : "";

  const getLineControlPoints = () => {
    if (isFinite(fSlope.current) && isFinite(fIntercept.current)) {
      const board = line.board;
      const intersections = getBoundingBoxIntersections(fSlope.current, fIntercept.current, board);
      if (!intersections.length) return undefined;
      let point1: [number, number];
      let point2: [number, number];
      if (board.hasPoint(0, fIntercept.current)) {
        point1 = [0, fIntercept.current];
        const maxX = intersections[1][0];
        const middleX = maxX / 2;
        point2 = [middleX, solveForY(fSlope.current, fIntercept.current, middleX)];
      } else {
        const minX = intersections[0][0];
        const maxX = intersections[1][0];
        const lineWidth = maxX - minX;
        const thirdLineWidth = lineWidth / 3;
        const x1 = minX + thirdLineWidth;
        const x2 = minX + thirdLineWidth * 2;
        point1 = [x1, solveForY(fSlope.current, fIntercept.current, x1)];
        point2 = [x2, solveForY(fSlope.current, fIntercept.current, x2)];
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

  // const handleKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
  //   evt.stopPropagation();
  //   if (evt.keyCode === 13) {
  //     this.handleAccept();
  //   } else if (evt.keyCode === 27) {
  //     this.handleCancel();
  //   }
  // };

  const [showModal, hideModal] = useCustomModal({
    Icon: LinkGraphIcon,
    title: "Edit Line",
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
