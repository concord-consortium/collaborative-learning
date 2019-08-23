import { observer, inject } from "mobx-react";
import * as React from "react";

import { CellPositions, FourUpGridCellModelType, FourUpGridModel,
         FourUpGridModelType } from "../models/view/four-up-grid";
import { CanvasComponent } from "./document/canvas";
import { BaseComponent, IBaseProps } from "./base";
import { DocumentModelType } from "../models/document/document";
import { GroupUserModelType } from "../models/stores/groups";
import { IToolApiInterface } from "./tools/tool-tile";

import "./four-up.sass";

interface IProps extends IBaseProps {
  userId?: string;
  groupId?: string;
  isGhostUser?: boolean;
  toolApiInterface?: IToolApiInterface;
}

interface FourUpUser {
  user: GroupUserModelType;
  doc?: DocumentModelType;
}

// The bottom of the four-up view is covered by the border of the bottom nav, so this lost height must be considered
export const BORDER_SIZE = 4;

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
        height: this.container.offsetHeight - BORDER_SIZE,
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

    const { groups, documents } = this.stores;
    const { userId, groupId, isGhostUser, ...others } = this.props;

    const group = groups.getGroupById(groupId);
    const groupDocuments = group && groupId &&
                           documents.getProblemDocumentsForGroup(groupId) || [];
    const groupUsers: FourUpUser[] = group
      ? group.users
          .map((groupUser) => {
            const groupUserDoc = groupDocuments && groupDocuments.find((groupDocument) => {
              return groupDocument.uid === groupUser.id;
            });
            return {
              user: groupUser,
              doc: groupUserDoc,
              initials: groupUser.initials
            };
          })
      : [];
    // put the primary user's document first (i.e. in the upper-left corner)
    groupUsers.sort((a, b) => {
      if (a.user.id === userId) return -1;
      if (b.user.id === userId) return 1;
      return 0;
    });

    const groupDoc = (index: number) => {
      return groupUsers[index] && groupUsers[index].doc;
    };

    const hideCanvas = (index: number) => {
      const doc = groupDoc(index);
      const unopenedDoc = groupUsers[index] && !doc;
      // Don't hide anything from ghost users, and treat unopened documents as private by default
      return !isGhostUser && (unopenedDoc || doc && doc.visibility === "private");
    };

    const nwCanvas = (
      <CanvasComponent context="four-up-nw" scale={nwCell.scale}
                       editabilityLocation={groupUsers[0] && "north west"}
                       readOnly={isGhostUser /* Ghost users do not own group documents and cannot edit others' */}
                       document={groupDoc(0)} {...others} />
    );
    const neCanvas = (
      <CanvasComponent context="four-up-ne" scale={neCell.scale}
                       editabilityLocation={groupUsers[1] && "north east"}
                       readOnly={true} document={groupDoc(1)} {...others} />
    );
    const seCanvas = (
      <CanvasComponent context="four-up-se" scale={seCell.scale}
                       editabilityLocation={groupUsers[2] && "south east"}
                       readOnly={true} document={groupDoc(2)} {...others}/>
    );
    const swCanvas = (
      <CanvasComponent context="four-up-sw" scale={swCell.scale}
                       editabilityLocation={groupUsers[3] && "south west"}
                       readOnly={true} document={groupDoc(3)} {...others}/>
    );

    return (
      <div className="four-up" ref={(el) => this.container = el}>
        <div className="canvas-container north-west" style={nwStyle}>
          <div className="canvas-scaler" style={scaleStyle(nwCell)}>
            {nwCanvas}
          </div>
          {groupUsers[0] && <div className="member">{groupUsers[0].user.initials}</div>}
        </div>
        <div className="canvas-container north-east" style={neStyle}>
          <div className="canvas-scaler" style={scaleStyle(neCell)}>
            {hideCanvas(1) ? this.renderUnshownMessage(groupUsers[1], "ne") : neCanvas}
          </div>
          {groupUsers[1] && <div className="member">{groupUsers[1].user.initials}</div>}
        </div>
        <div className="canvas-container south-east" style={seStyle}>
          <div className="canvas-scaler" style={scaleStyle(seCell)}>
            {hideCanvas(2) ? this.renderUnshownMessage(groupUsers[2], "se") : seCanvas}
          </div>
          {groupUsers[2] && <div className="member">{groupUsers[2].user.initials}</div>}
        </div>
        <div className="canvas-container south-west" style={swStyle}>
          <div className="canvas-scaler" style={scaleStyle(swCell)}>
            {hideCanvas(3) ? this.renderUnshownMessage(groupUsers[3], "sw") : swCanvas}
          </div>
          {groupUsers[3] && <div className="member">{groupUsers[3].user.initials}</div>}
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

  private renderUnshownMessage = (groupUser: FourUpUser, location: "ne" | "se" | "sw") => {
    const groupUserName = groupUser ? groupUser.user.name : "User";
    return (
      <div className={`unshared ${location}`}>
        <svg className={`icon icon-unshare`}>
          <use xlinkHref={`#icon-unshare`} />
        </svg>
        <div>
          {`${groupUserName} has not shared their workspace.`}
        </div>
      </div>
    );
  }

  private handleResizeWindow = (e: UIEvent) => {
    if (this.container) {
      this.grid.update({
        height: this.container.offsetHeight - BORDER_SIZE,
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
