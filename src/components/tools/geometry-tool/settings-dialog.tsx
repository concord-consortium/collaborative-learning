import * as React from "react";
import { Button, Dialog } from "@blueprintjs/core";
import { guessUserDesiredBoundingBox } from "../../../models/tools/geometry/jxg-board";

interface IProps {
  board: JXG.Board;
  onAccept: (xMax: number, yMax: number, xMin: number, yMin: number) => void;
  onClose: () => void;
}

interface IState {
  xMin: string;
  yMin: string;
  xMax: string;
  yMax: string;
}

export default class SettingsDialog extends React.Component<IProps, IState> {
  public boundingBox = guessUserDesiredBoundingBox(this.props.board);
  public state = {
            xMin: JXG.toFixed(this.boundingBox[0], 1),
            yMax: JXG.toFixed(this.boundingBox[1], 1),
            xMax: JXG.toFixed(this.boundingBox[2], 1),
            yMin: JXG.toFixed(this.boundingBox[3], 1)
          };

  public render() {
    return (
      <Dialog
        icon="text-highlight"
        isOpen={true}
        onClose={this.props.onClose}
        title={`Edit Axes`}
        canOutsideClickClose={false}
      >
        <div className="nc-dialog-row">
          { this.renderOption("x min", this.state.xMin, this.handleXMinChange) }
          { this.renderOption("x max", this.state.xMax, this.handleXMaxChange) }
        </div>
        <div className="nc-dialog-row">
          { this.renderOption("y min", this.state.yMin, this.handleYMinChange) }
          { this.renderOption("y max", this.state.yMax, this.handleYMaxChange) }
        </div>
        <div className="nc-dialog-buttons">
          <Button
            className="nc-dialog-button pt-intent-primary"
            text="OK"
            onClick={this.handleAccept}
          />
          <Button className="nc-dialog-button" text="Cancel"  onClick={this.handleCancel}/>
        </div>
      </Dialog>
    );
  }

  private renderOption = (title: string, value: string, onChange: (evt: React.FormEvent<HTMLInputElement>) => void) => {
    return (
      <div>
        <div className="nc-attribute-name-prompt">{`${title}:`}</div>
          <input
            className="nc-attribute-name-input pt-input"
            type="text"
            maxLength={5}
            value={value}
            onChange={onChange}
            onKeyDown={this.handleKeyDown}
            dir="auto"
          />
      </div>
    );
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
    const xMax = parseFloat(this.state.xMax);
    const yMax = parseFloat(this.state.yMax);
    const xMin = parseFloat(this.state.xMin);
    const yMin = parseFloat(this.state.yMin);
    if (!isNaN(xMax) && !isNaN(yMax) && !isNaN(xMin) && !isNaN(yMin)) {
      onAccept(xMax, yMax, xMin, yMin);
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
