import React from "react";
import { copyCoords, getEventCoords, rotateCoords } from "../../../models/tools/geometry/geometry-utils";

interface IProps {
  board?: JXG.Board;
  polygon?: JXG.Polygon;
  scale?: number;
  onRotate: (polygon: JXG.Polygon, vertexPositions: JXG.Coords[], isComplete: boolean) => void;
}

interface IState {
  polygonId?: string;
  deltaAngle?: number;
  iconAnchor?: JXG.Coords;
}

const kIconWidth = 16;
const kIconHalfWidth = kIconWidth / 2;
const kUpdateThreshold = 50;

export class RotatePolygonIcon extends React.Component<IProps, IState> {

  public static getDerivedStateFromProps: any = (nextProps: IProps, prevState: IState) => {
    // reset if polygon changes
    return (!nextProps.polygon || (nextProps.polygon.id !== prevState.polygonId))
            ? { polygonId: nextProps.polygon ? nextProps.polygon.id : undefined, iconAnchor: undefined }
            : {};
  }

  public state: IState = {};

  private polygonCenter: JXG.Coords;
  private initialIconAnchor: JXG.Coords;
  private initialVertexCoords: { [id: string]: JXG.Coords } = {};
  private initialDragAngle: number;
  private lastDragUpdate: number;

  public render() {
    const { board, polygon } = this.props;
    const isEnabled = !!board && !!polygon;
    const iconStyle = isEnabled
                        ? (this.state.iconAnchor
                            ? this.getDragIconLocation()
                            : this.getDefaultIconLocation())
                        : undefined;
    return (
      <div className={`rotate-polygon-icon ${isEnabled ? "enabled" : ""}`}
          style={iconStyle}
          onMouseDown={this.handleMouseDown}
        />
    );
  }

  private getDefaultIconCoords() {
    const { board, polygon } = this.props;
    if (!board || !polygon) return;

    const polygonBounds = polygon.bounds();
    return new JXG.Coords(
                JXG.COORDS_BY_USER,
                [polygonBounds[2] + kIconWidth / board.unitX,
                  (polygonBounds[1] + polygonBounds[3]) / 2],
                board);
  }

  private getDefaultIconLocation() {
    const iconCoords = this.getDefaultIconCoords();
    return iconCoords
            ? { left: iconCoords.scrCoords[1] - kIconHalfWidth,
                top: iconCoords.scrCoords[2] - kIconHalfWidth }
            : undefined;
  }

  private getDragIconLocation() {
    const { iconAnchor } = this.state;
    return { left: iconAnchor!.scrCoords[1] - kIconHalfWidth,
              top: iconAnchor!.scrCoords[2] - kIconHalfWidth };
  }

  private computeAngle(center: JXG.Coords, e: MouseEvent | React.MouseEvent) {
    const { board, scale } = this.props;
    if (!board) return 0;
    const eventCoords = getEventCoords(board, e, scale);
    const dx = eventCoords.usrCoords[1] - center.usrCoords[1];
    const dy = eventCoords.usrCoords[2] - center.usrCoords[2];
    return Math.atan2(dy, dx);
  }

  private rotateVertices(polygon: JXG.Polygon, deltaAngle: number, isComplete: boolean) {
    const vertexPositions: JXG.Coords[] = [];
    polygon.vertices.forEach((vertex, index) => {
      if (index < polygon.vertices.length - 1) {
        const initialCoords = this.initialVertexCoords[vertex.id];
        const newCoords = rotateCoords(initialCoords, this.polygonCenter, deltaAngle);
        vertexPositions.push(newCoords);
      }
    });
    this.props.onRotate(polygon, vertexPositions, isComplete);
  }

  private handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    const { board, polygon } = this.props;
    if (!board || !polygon) return;

    const polygonBounds = polygon.bounds();
    const centerCoords = [(polygonBounds[0] + polygonBounds[2]) / 2,
                          (polygonBounds[1] + polygonBounds[3]) / 2];
    this.polygonCenter = new JXG.Coords(JXG.COORDS_BY_USER, centerCoords, board);
    this.initialIconAnchor = this.state.iconAnchor
                              ? copyCoords(this.state.iconAnchor)
                              : this.getDefaultIconCoords() as JXG.Coords;
    polygon.vertices.forEach(vertex => {
      this.initialVertexCoords[vertex.id] = copyCoords(vertex.coords);
    });
    this.initialDragAngle = this.computeAngle(this.polygonCenter, e);

    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("mouseup", this.handleMouseUp);
    this.setState({ iconAnchor: this.initialIconAnchor });
  }

  private handleMouseMove = (e: MouseEvent) => {
    e.preventDefault();

    const { board, polygon } = this.props;
    if (!board || !polygon) return;

    const thisTime = new Date().getTime();
    if (this.lastDragUpdate && (thisTime < this.lastDragUpdate + kUpdateThreshold)) return;
    this.lastDragUpdate = thisTime;

    const dragAngle = this.computeAngle(this.polygonCenter, e);
    const deltaAngle = dragAngle - this.initialDragAngle;
    const iconAnchor = rotateCoords(this.initialIconAnchor, this.polygonCenter, deltaAngle);
    this.setState({ deltaAngle, iconAnchor });

    this.rotateVertices(polygon, deltaAngle, false);
  }

  private handleMouseUp = (e: MouseEvent) => {
    e.preventDefault();

    const { board, polygon } = this.props;
    if (board && polygon) {
      const dragAngle = this.computeAngle(this.polygonCenter, e);
      const deltaAngle = dragAngle - this.initialDragAngle;
      this.rotateVertices(polygon, deltaAngle, true);
    }

    this.initialVertexCoords = {};

    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mouseup", this.handleMouseUp);
  }
}
