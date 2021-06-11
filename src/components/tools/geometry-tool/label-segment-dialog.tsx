import React from "react";
import { Button, Dialog, RadioGroup, Radio } from "@blueprintjs/core";
import { ESegmentLabelOption } from "../../../models/tools/geometry/jxg-changes";
import { getPolygonEdge } from "../../../models/tools/geometry/jxg-polygon";
import "./label-segment-dialog.sass";

interface IProps {
  board: JXG.Board;
  polygon: JXG.Polygon;
  points: [JXG.Point, JXG.Point];
  isOpen: boolean;
  onAccept: (polygon: JXG.Polygon, points: [JXG.Point, JXG.Point], labelOption: ESegmentLabelOption) => void;
  onClose: () => void;
}

interface IState {
  segment?: JXG.Line;
  initialLabelOption?: ESegmentLabelOption;
  labelOption: ESegmentLabelOption;
}

function getPolygonSegment(board: JXG.Board, polygon: JXG.Polygon, points: [JXG.Point, JXG.Point]) {
  const pointIds = points.map(pt => pt.id);
  return getPolygonEdge(board, polygon.id, pointIds);
}

function getInitialState(props: IProps): IState {
  const segment = getPolygonSegment(props.board, props.polygon, props.points);
  const labelOption = segment?.getAttribute("clientLabelOption") || "none";
  return { segment, initialLabelOption: labelOption, labelOption };
}

export default
class LabelSegmentDialog extends React.Component<IProps, IState> {

  public state: IState = { labelOption: ESegmentLabelOption.kNone };

  public componentDidMount() {
    this.setState(getInitialState(this.props));
  }

  public render() {
    return (
      <Dialog
        icon="label"
        isOpen={this.props.isOpen}
        onClose={this.props.onClose}
        title={`Edit Segment Label`}
        canEscapeKeyClose={true}
        canOutsideClickClose={false}
      >
        <RadioGroup
            className="nc-radio-group edit-segment-label-radio"
            selectedValue={this.state.labelOption}
            onChange={this.handleLabelOptionChange}
        >
            <Radio label="None" value={ESegmentLabelOption.kNone} />
            <Radio label="Label" value={ESegmentLabelOption.kLabel} />
            <Radio label="Length" value={ESegmentLabelOption.kLength} />
        </RadioGroup>
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

  private handleLabelOptionChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({labelOption: (evt.target as HTMLInputElement).value as ESegmentLabelOption });
  }

  private handleAccept = () => {
    const { polygon, points, onAccept } = this.props;
    const { initialLabelOption, labelOption } = this.state;
    if (polygon && points && (initialLabelOption !== labelOption)) {
      onAccept(polygon, points, labelOption);
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
