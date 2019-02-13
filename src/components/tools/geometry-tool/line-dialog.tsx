import * as React from "react";
import { Button, Dialog } from "@blueprintjs/core";
import { getBoundingBoxIntersections, solveForY } from "../../../models/tools/geometry/jxg-movable-line";
import { round } from "lodash";

interface IProps {
  line: JXG.Line;
  isOpen: boolean;
  onAccept: (line: JXG.Line, point1: [number, number], point2: [number, number]) => void;
  onClose: () => void;
}

interface IState {
  slope: string;
  intercept: string;
}

export default
class LineDialog extends React.Component<IProps, IState> {
  public state = {
            slope: "" + round(this.props.line.getSlope(), 1) || "",
            intercept: "" + round(this.props.line.getRise(), 1) || "",
          };

  public render() {
    const errorMessage = this.getValidationError();
    return (
      <Dialog
        icon="text-highlight"
        isOpen={this.props.isOpen}
        onClose={this.props.onClose}
        title={`Edit Line`}
        canOutsideClickClose={false}
      >
        <div className="nc-attribute-name-prompt">Slope:</div>
        <input
          className="nc-attribute-name-input pt-input"
          type="text"
          maxLength={5}
          value={this.state.slope}
          onChange={this.handleSlopeChange}
          onKeyDown={this.handleKeyDown}
          dir="auto"
        />
        <div className="nc-attribute-name-prompt">y-intercept:</div>
        <input
          className="nc-attribute-name-input pt-input"
          type="text"
          maxLength={5}
          value={this.state.intercept}
          onChange={this.handleInterceptChange}
          onKeyDown={this.handleKeyDown}
          dir="auto"
        />
        <div className="nc-dialog-error">
          {errorMessage}
        </div>
        <div className="nc-dialog-buttons">
          <Button
            className="nc-dialog-button pt-intent-primary"
            text="OK"
            onClick={this.handleAccept}
            disabled={errorMessage != null}
          />
          <Button className="nc-dialog-button" text="Cancel"  onClick={this.handleCancel}/>
        </div>
      </Dialog>
    );
  }

  private handleSlopeChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({slope: (evt.target as HTMLInputElement).value });
  }

  private handleInterceptChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({intercept: (evt.target as HTMLInputElement).value });
  }

  private getValidationError = () => {
    const { line } = this.props;
    const slope = parseFloat(this.state.slope);
    const intercept = parseFloat(this.state.intercept);
    if (isNaN(slope) || isNaN(intercept)) {
      return "Please enter a valid integer or decimal for slope and intercept.";
    }
    const intersections = getBoundingBoxIntersections(slope, intercept, line.board);
    if (intersections.length < 2) {
      return "Line would fall offscreen; please edit the slope or intercept.";
    }
  }

  private getLineControlPoints = () => {
    const { line } = this.props;
    const slope = parseFloat(this.state.slope);
    const intercept = parseFloat(this.state.intercept);
    if (!isNaN(slope) && !isNaN(intercept)) {
      const board = line.board;
      const intersections = getBoundingBoxIntersections(slope, intercept, board);
      if (!intersections.length) return undefined;
      let point1: [number, number];
      let point2: [number, number];
      if (board.hasPoint(0, intercept)) {
        point1 = [0, intercept];
        const maxX = intersections[1][0];
        const middleX = maxX / 2;
        point2 = [middleX, solveForY(slope, intercept, middleX)];
      } else {
        const minX = intersections[0][0];
        const maxX = intersections[1][0];
        const lineWidth = maxX - minX;
        const thirdLineWidth = lineWidth / 3;
        const x1 = minX + thirdLineWidth;
        const x2 = minX + thirdLineWidth * 2;
        point1 = [x1, solveForY(slope, intercept, x1)];
        point2 = [x2, solveForY(slope, intercept, x2)];
      }
      return [point1, point2];
    } else {
      return undefined;
    }
  }

  private handleAccept = () => {
    const { line, onAccept } = this.props;
    const points = this.getLineControlPoints();
    if (points) {
      onAccept(line, points[0], points[1]);
    } else {
      this.handleCancel();
    }
  }

  private handleCancel = () => {
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  private handleKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (evt.keyCode === 13) {
      this.handleAccept();
    } else if (evt.keyCode === 27) {
      this.handleCancel();
    }
  }

}
