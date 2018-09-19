import { observer, inject } from "mobx-react";
import * as React from "react";

import { CellPositions, FourUpGridCellModelType, FourUpGridModel,
         FourUpGridModelType, IGridUpdate } from "../models/four-up-grid";
import { WorkspaceModelType } from "../models/workspaces";
import { CanvasComponent } from "./canvas";
import { BaseComponent, IBaseProps } from "./base";

import "./four-up.sass";
import { values } from "mobx";
import { DocumentModelType } from "../models/document";

interface IProps extends IBaseProps {
  workspace: WorkspaceModelType;
}

interface FourUpUser {
  doc: DocumentModelType|undefined;
  initials: string;
}

@inject("stores")
@observer
export class FourUpComponent extends BaseComponent<IProps, {}> {
  private grid: FourUpGridModelType;
  private container: HTMLDivElement | null;

  constructor(props: IProps) {
    super(props);

    // use local grid model
    this.grid = FourUpGridModel.create({
      splitterSize: 3,
    });
  }

  public componentDidMount() {
    if (this.container) {
      this.grid.update({
        height: this.container.offsetHeight,
        initSplitters: true,
        width: this.container.offsetWidth,
      });
    }
    window.addEventListener("resize", this.handleResizeWindow);
  }

  public componentWillUnmount() {
    window.removeEventListener("resize", this.handleResizeWindow);
  }

  public render() {
    const {width, height} = this.grid;
    const nwCell = this.grid.cells[CellPositions.NorthWest];
    const neCell = this.grid.cells[CellPositions.NorthEast];
    const seCell = this.grid.cells[CellPositions.SouthEast];
    const swCell = this.grid.cells[CellPositions.SouthWest];
    const nwStyle = {top: 0, left: 0, width: nwCell.width, height: nwCell.height};
    const neStyle = {top: 0, left: neCell.left, right: 0, height: neCell.height};
    const seStyle = {top: seCell.top, left: seCell.left, right: 0, bottom: 0};
    const swStyle = {top: swCell.top, left: 0, width: swCell.width, bottom: 0};
    const scaleStyle = (cell: FourUpGridCellModelType) => {
      const transform = `scale(${cell.scale})`;
      return {width, height, transform, transformOrigin: "0 0"};
    };

    const { groups, user } = this.stores;
    const { workspace } = this.props;

    const group = groups.groupForUser(user.id);
    const groupUsers: FourUpUser[] = group
      ? group.users
          .filter((groupUser) => groupUser.id !== user.id)
          .map((groupUser) => {
            const groupUserDoc = workspace.groupDocuments.get(groupUser.id);
            return {
              doc: groupUserDoc,
              initials: groupUser.initials
            };
          })
      : [];

    return (
      <div className="four-up" ref={(el) => this.container = el}>
        <div className="canvas-container north-west" style={nwStyle}>
          <div className="canvas-scaler" style={scaleStyle(nwCell)}>
            <CanvasComponent context="four-up-nw" document={workspace.userDocument} />
          </div>
          <div className="member">{user.initials}</div>
        </div>
        <div className="canvas-container north-east" style={neStyle}>
          <div className="canvas-scaler" style={scaleStyle(neCell)}>
            <CanvasComponent context="four-up-ne" document={groupUsers[0] && groupUsers[0].doc} />
          </div>
          {groupUsers[0] && <div className="member">{groupUsers[0].initials}</div>}
        </div>
        <div className="canvas-container south-east" style={seStyle}>
          <div className="canvas-scaler" style={scaleStyle(seCell)}>
            <CanvasComponent context="four-up-se" document={groupUsers[1] && groupUsers[1].doc} />
          </div>
          {groupUsers[1] && <div className="member">{groupUsers[1].initials}</div>}
        </div>
        <div className="canvas-container south-west" style={swStyle}>
          <div className="canvas-scaler" style={scaleStyle(swCell)}>
            <CanvasComponent context="four-up-sw" document={groupUsers[2] && groupUsers[2].doc} />
          </div>
          {groupUsers[2] && <div className="member">{groupUsers[2].initials}</div>}
        </div>
        <div
          className="horizontal splitter"
          style={{top: this.grid.hSplitter, height: this.grid.splitterSize}}
          onMouseDown={this.handleHSplitter}
        />
        <div
          className="vertical splitter"
          style={{left: this.grid.vSplitter, width: this.grid.splitterSize}}
          onMouseDown={this.handleVSplitter}
        />
        <div
          className="center"
          style={{
            height: this.grid.splitterSize * 3,
            left: this.grid.vSplitter - this.grid.splitterSize,
            top: this.grid.hSplitter - this.grid.splitterSize,
            width: this.grid.splitterSize * 3,
          }}
          onMouseDown={this.handleCenter}
        />
      </div>
    );
  }

  private handleResizeWindow = (e: UIEvent) => {
    if (this.container) {
      this.grid.update({
        height: this.container.offsetHeight,
        resizeSplitters: true,
        width: this.container.offsetWidth,
      });
    }
  }

  private handleHSplitter = (e: React.MouseEvent<HTMLDivElement>) => {
    this.handleSplitters(e, true, false);
  }

  private handleVSplitter = (e: React.MouseEvent<HTMLDivElement>) => {
    this.handleSplitters(e, false, true);
  }

  private handleCenter = (e: React.MouseEvent<HTMLDivElement>) => {
    this.handleSplitters(e, true, true);
  }

  private handleSplitters = (e: React.MouseEvent<HTMLDivElement>, allowHorizontal: boolean, allowVertical: boolean) => {
    const start = {
      hSplitter: this.grid.hSplitter,
      vSplitter: this.grid.vSplitter,
      x: e.clientX,
      y: e.clientY,
    };

    const handleMouseMove = (moveE: MouseEvent) => {
      this.grid.update({
        hSplitter: allowHorizontal ? start.hSplitter + (moveE.clientY - start.y) : start.hSplitter,
        vSplitter: allowVertical ? start.vSplitter + (moveE.clientX - start.x) : start.vSplitter,
      });
    };

    const handleMouseUp = (upE: MouseEvent) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }
}
