import * as React from "react";
import { Button, Dialog } from "@blueprintjs/core";
import { IAxesParams } from "../../../models/tools/geometry/geometry-content";
import { getAxisAnnotations, getBaseAxisLabels, guessUserDesiredBoundingBox } from "../../../models/tools/geometry/jxg-board";
import "./axis-settings-dialog.sass";

interface IProps {
  board: JXG.Board;
  onAccept: (params: IAxesParams) => void;
  onClose: () => void;
}

interface IState {
  xName: string;
  yName: string;
  xAnnotation: string;
  yAnnotation: string;
  xMin: string;
  yMin: string;
  xMax: string;
  yMax: string;
}

const kBoundsMaxChars = 6;
const kNameMaxChars = 20;
const kLabelMaxChars = 40;

export default class AxisSettingsDialog extends React.Component<IProps, IState> {
  public state = ((board: JXG.Board) => {
                    const [xName, yName] = getBaseAxisLabels(board);
                    const [xAnnotation, yAnnotation] = getAxisAnnotations(board);
                    const bBox = guessUserDesiredBoundingBox(board);
                    return {
                      xName,
                      yName,
                      xAnnotation,
                      yAnnotation,
                      xMin: JXG.toFixed(Math.min(0, bBox[0]), 1),
                      yMax: JXG.toFixed(Math.max(0, bBox[1]), 1),
                      xMax: JXG.toFixed(Math.max(0, bBox[2]), 1),
                      yMin: JXG.toFixed(Math.min(0, bBox[3]), 1)
                    };
                  })(this.props.board);

  public render() {
    const errorMessage = this.getValidationError();
    return (
      <Dialog
        className="axis-settings-dialog"
        icon="text-highlight"
        isOpen={true}
        onClose={this.props.onClose}
        title={`Edit Axes`}
        canOutsideClickClose={false}
      >
        <div className="nc-dialog-row">
          <div className="nc-attribute-name-prompt">
            <span className="axis-prompt x-axis">X Axis</span>
            <span className="axis-prompt y-axis">Y Axis</span>
          </div>
        </div>
        <div className="nc-dialog-row">
          <div className="nc-attribute-name-prompt">
            <span className="name-prompt">Name:</span>
            { this.renderOption(this.state.xName, kNameMaxChars, this.handleXNameChange) }
            { this.renderOption(this.state.yName, kNameMaxChars, this.handleYNameChange) }
          </div>
        </div>
        <div className="nc-dialog-row">
          <div className="nc-attribute-name-prompt">
            <span className="annotation-prompt">Label:</span>
            { this.renderOption(this.state.xAnnotation, kLabelMaxChars, this.handleXAnnotationChange) }
            { this.renderOption(this.state.yAnnotation, kLabelMaxChars, this.handleYAnnotationChange) }
          </div>
        </div>
        <div className="nc-dialog-row">
          <div className="nc-attribute-name-prompt">
            <span className="min-prompt">Min:</span>
            { this.renderOption(this.state.xMin, kBoundsMaxChars, this.handleXMinChange) }
            { this.renderOption(this.state.yMin, kBoundsMaxChars, this.handleYMinChange) }
          </div>
        </div>
        <div className="nc-dialog-row">
          <div className="nc-attribute-name-prompt">
            <span className="max-prompt">Max:</span>
            { this.renderOption(this.state.xMax, kBoundsMaxChars, this.handleXMaxChange) }
            { this.renderOption(this.state.yMax, kBoundsMaxChars, this.handleYMaxChange) }
          </div>
        </div>
        <div className="nc-dialog-error">
          {errorMessage || "\u00a0"}
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

  private getValidationError = () => {
    const xMin = parseFloat(this.state.xMin);
    const xMax = parseFloat(this.state.xMax);
    const yMin = parseFloat(this.state.yMin);
    const yMax = parseFloat(this.state.yMax);
    if (!isFinite(xMin) || !isFinite(xMax) || !isFinite(yMin) || !isFinite(yMax)) {
      return "Please enter valid numbers for axis minimum and maximum values";
    }
    if (xMin > 0 || yMin > 0) {
      return "Axis minimum values must be less than or equal to 0.";
    }
    if (xMax < 0 || yMax < 0) {
      return "Axis maximum values must be greater than or equal to 0.";
    }
    if (xMax <= xMin || yMax <= yMin) {
      return "Axis minimum values must be less than axis maximum values";
    }
  }

  private renderOption = (value: string, maxLength: number,
                          onChange: (evt: React.FormEvent<HTMLInputElement>) => void) => {
    return (
      <input
        className="nc-attribute-name-input pt-input"
        type="text"
        maxLength={maxLength}
        value={value}
        onChange={onChange}
        onKeyDown={this.handleKeyDown}
        dir="auto"
      />
    );
  }

  private handleXNameChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({xName: (evt.target as HTMLInputElement).value });
  }

  private handleYNameChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({yName: (evt.target as HTMLInputElement).value });
  }

  private handleXAnnotationChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({xAnnotation: (evt.target as HTMLInputElement).value });
  }

  private handleYAnnotationChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({yAnnotation: (evt.target as HTMLInputElement).value });
  }

  private handleXMinChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({xMin: (evt.target as HTMLInputElement).value });
  }

  private handleYMinChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({yMin: (evt.target as HTMLInputElement).value });
  }

  private handleXMaxChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({xMax: (evt.target as HTMLInputElement).value });
  }

  private handleYMaxChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({yMax: (evt.target as HTMLInputElement).value });
  }

  private handleAccept = () => {
    const { onAccept } = this.props;
    const { xName, yName, xAnnotation, yAnnotation } = this.state;
    const xMax = parseFloat(this.state.xMax);
    const yMax = parseFloat(this.state.yMax);
    const xMin = parseFloat(this.state.xMin);
    const yMin = parseFloat(this.state.yMin);
    if (isFinite(xMax) && isFinite(yMax) && isFinite(xMin) && isFinite(yMin)) {
      onAccept({ xName, yName, xAnnotation, yAnnotation, xMax, yMax, xMin, yMin });
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
    evt.stopPropagation();
    if (evt.keyCode === 13) {
      this.handleAccept();
    } else if (evt.keyCode === 27) {
      this.handleCancel();
    }
  }

}
