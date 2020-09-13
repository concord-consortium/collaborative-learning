import { observer, inject } from "mobx-react";
import React from "react";
import ResizeObserver from "resize-observer-polyfill";

import { BaseComponent, IBaseProps } from "./base";
import { CanvasComponent } from "./document/canvas";
import { DocumentViewMode } from "./document/document";
import { DocumentModelType } from "../models/document/document";
import { GroupUserModelType } from "../models/stores/groups";
import { CellPositions, FourUpGridCellModelType, FourUpGridModel, FourUpGridModelType
      } from "../models/view/four-up-grid";
import { IToolApiInterface } from "./tools/tool-tile";
import { FourUpOverlayComponent } from "./four-up-overlay";
import { Logger, LogEventName } from "../lib/logger";

import "./four-up.sass";

interface IProps extends IBaseProps {
  userId?: string;
  groupId?: string;
  isGhostUser?: boolean;
  toolApiInterface?: IToolApiInterface;
  toggleable?: boolean;
  documentViewMode?: DocumentViewMode;
  selectedSectionId?: string | null;
  viaTeacherDashboard?: boolean;
  setFocusedGroupUser?: (focusedGroupUser?: GroupUserModelType) => void;
}

interface IState {
  toggledContext: string | null;
}

interface FourUpUser {
  user: GroupUserModelType;
  doc?: DocumentModelType;
}

interface ContextUserMap {
  [key: string]: FourUpUser | undefined;
}

// The bottom of the four-up view is covered by the border of the bottom nav, so this lost height must be considered
export const BORDER_SIZE = 4;

@inject("stores")
@observer
export class FourUpComponent extends BaseComponent<IProps, IState> {
  private grid: FourUpGridModelType;
  private container: HTMLDivElement | null;
  private resizeObserver: ResizeObserver;
  private roIsInitialized = false;
  private userByContext: ContextUserMap = {};

  constructor(props: IProps) {
    super(props);

    this.state = {
      toggledContext: null
    };

    // use local grid model
    this.grid = FourUpGridModel.create({
      splitterSize: 3,
    });
  }

  public componentDidMount() {
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === this.container) {
          const {width, height} = entry.contentRect;
          if (width > 0 && height > 0) {
            this.grid.update({
              height: height - BORDER_SIZE,
              initSplitters: !this.roIsInitialized,
              resizeSplitters: this.roIsInitialized,
              width
            });
            this.roIsInitialized = true;
          }
        }
      }
    });
    this.container && this.resizeObserver.observe(this.container);
  }

  public componentWillUnmount() {
    this.resizeObserver.disconnect();
  }

  public render() {
    const {documentViewMode} = this.props;
    const {toggledContext} = this.state;
    const {width, height} = this.grid;
    const nwCell = this.grid.cells[CellPositions.NorthWest];
    const neCell = this.grid.cells[CellPositions.NorthEast];
    const seCell = this.grid.cells[CellPositions.SouthEast];
    const swCell = this.grid.cells[CellPositions.SouthWest];
    const toggledStyle = {top: 0, left: 0, width, height};
    const nwStyle = toggledContext ? toggledStyle : {top: 0, left: 0, width: nwCell.width, height: nwCell.height};
    const neStyle = toggledContext ? toggledStyle : {top: 0, left: neCell.left, right: 0, height: neCell.height};
    const seStyle = toggledContext ? toggledStyle : {top: seCell.top, left: seCell.left, right: 0, bottom: 0};
    const swStyle = toggledContext ? toggledStyle : {top: swCell.top, left: 0, width: swCell.width, bottom: 0};
    const scaleStyle = (cell: FourUpGridCellModelType) => {
      const transform = `scale(${toggledContext ? 1 : cell.scale})`;
      return {width, height, transform, transformOrigin: "0 0"};
    };

    const { groups, documents } = this.stores;
    const { userId, groupId, isGhostUser, toggleable, ...others } = this.props;

    const group = groups.getGroupById(groupId);
    const groupDocuments = group && groupId &&
                           (documentViewMode === DocumentViewMode.Published
                             ? documents.getLastPublishedProblemDocumentsForGroup(groupId)
                             : documents.getProblemDocumentsForGroup(groupId)
                           ) || [];
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

    // save reference to use for the username display in this render and logger in #handleOverlayClicked
    this.userByContext = {
      "four-up-nw": groupUsers[0],
      "four-up-ne": groupUsers[1],
      "four-up-se": groupUsers[2],
      "four-up-sw": groupUsers[3],
    };

    const groupDoc = (index: number) => {
      return groupUsers[index] && groupUsers[index].doc;
    };

    const hideCanvas = (index: number) => {
      const doc = groupDoc(index);
      const unopenedDoc = groupUsers[index] && !doc;
      // Don't hide anything from ghost users, and treat unopened documents as private by default
      return !isGhostUser && (unopenedDoc || doc && doc.visibility === "private");
    };

    const canvasMessage = (document?: DocumentModelType) => {
      if (!document && (documentViewMode === DocumentViewMode.Published)) {
        return "Not Published";
      }
    };

    const nwCanvas = (
      <CanvasComponent context="four-up-nw" scale={nwCell.scale}
                       editabilityLocation={toggleable ? undefined : groupUsers[0] && "north west"}
                       readOnly={isGhostUser /* Ghost users do not own group documents and cannot edit others' */}
                       document={groupDoc(0)} overlayMessage={canvasMessage(groupDoc(0))} {...others} />
    );
    const neCanvas = (
      <CanvasComponent context="four-up-ne" scale={neCell.scale}
                       editabilityLocation={toggleable ? undefined : groupUsers[1] && "north east"}
                       readOnly={true} document={groupDoc(1)} overlayMessage={canvasMessage(groupDoc(1))} {...others} />
    );
    const seCanvas = (
      <CanvasComponent context="four-up-se" scale={seCell.scale}
                       editabilityLocation={toggleable ? undefined : groupUsers[2] && "south east"}
                       readOnly={true} document={groupDoc(2)} overlayMessage={canvasMessage(groupDoc(2))} {...others}/>
    );
    const swCanvas = (
      <CanvasComponent context="four-up-sw" scale={swCell.scale}
                       editabilityLocation={toggleable ? undefined : groupUsers[3] && "south west"}
                       readOnly={true} document={groupDoc(3)} overlayMessage={canvasMessage(groupDoc(3))} {...others}/>
    );

    const memberName = (context: string) => {
      const groupUser = this.userByContext[context];
      const isToggled = context === toggledContext;
      if (groupUser) {
        const className = `member${isToggled ? " member-centered" : ""}`;
        const name = isToggled ? groupUser.user.name : groupUser.user.initials;
        return <div className={className}>{name}</div>;
      }
    };

    return (
      <div className="four-up" ref={(el) => this.container = el}>
        {!toggledContext || (toggledContext === "four-up-nw") ?
        <div className="canvas-container north-west" style={nwStyle}>
          <div className="canvas-scaler" style={scaleStyle(nwCell)}>
            {nwCanvas}
          </div>
          {memberName("four-up-nw")}
        </div> : null}
        {!toggledContext || (toggledContext === "four-up-ne") ?
        <div className="canvas-container north-east" style={neStyle}>
          <div className="canvas-scaler" style={scaleStyle(neCell)}>
            {hideCanvas(1) ? this.renderUnshownMessage(groupUsers[1], "ne") : neCanvas}
          </div>
          {memberName("four-up-ne")}
        </div> : null}
        {!toggledContext || (toggledContext === "four-up-se") ?
        <div className="canvas-container south-east" style={seStyle}>
          <div className="canvas-scaler" style={scaleStyle(seCell)}>
            {hideCanvas(2) ? this.renderUnshownMessage(groupUsers[2], "se") : seCanvas}
          </div>
          {memberName("four-up-se")}
        </div> : null}
        {!toggledContext || (toggledContext === "four-up-sw") ?
        <div className="canvas-container south-west" style={swStyle}>
          <div className="canvas-scaler" style={scaleStyle(swCell)}>
            {hideCanvas(3) ? this.renderUnshownMessage(groupUsers[3], "sw") : swCanvas}
          </div>
          {memberName("four-up-sw")}
        </div> : null}
        {!toggledContext ? this.renderSplitters() : null}
        {toggleable ? this.renderToggleOverlays(groupUsers) : null}
      </div>
    );
  }

  private renderSplitters() {
    return (
      <>
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
      </>
    );
  }

  private renderToggleOverlays(groupUsers: FourUpUser[]) {
    const {documentViewMode} = this.props;
    const {width, height, hSplitter, vSplitter} = this.grid;
    const toggledStyle = {top: 0, left: 0, width, height};
    const nwStyle = {top: 0, left: 0, width: vSplitter, height: hSplitter};
    const neStyle = {top: 0, left: vSplitter, right: 0, height: hSplitter};
    const seStyle = {top: hSplitter, left: vSplitter, right: 0, bottom: 0};
    const swStyle = {top: hSplitter, left: 0, width: vSplitter, bottom: 0};

    const groupDoc = (index: number) => {
      return groupUsers[index] && groupUsers[index].doc;
    };

    const toggledGroupDoc = (context: string) => {
      const user = this.userByContext[context];
      return user && user.doc;
    };

    const {toggledContext} = this.state;
    if (toggledContext) {
      return (
        <FourUpOverlayComponent
            context={toggledContext}
            style={toggledStyle}
            onClick={this.handleOverlayClicked}
            documentViewMode={documentViewMode}
            document={toggledGroupDoc(toggledContext)}
        />
      );
    } else {
      return (
        <div>
          <FourUpOverlayComponent
            context="four-up-nw"
            style={nwStyle}
            onClick={this.handleOverlayClicked}
            documentViewMode={documentViewMode}
            document={groupDoc(0)}
          />
          <FourUpOverlayComponent
            context="four-up-ne"
            style={neStyle}
            onClick={this.handleOverlayClicked}
            documentViewMode={documentViewMode}
            document={groupDoc(1)}
          />
          <FourUpOverlayComponent
            context="four-up-se"
            style={seStyle}
            onClick={this.handleOverlayClicked}
            documentViewMode={documentViewMode}
            document={groupDoc(2)}
          />
          <FourUpOverlayComponent
            context="four-up-sw"
            style={swStyle}
            onClick={this.handleOverlayClicked}
            documentViewMode={documentViewMode}
            document={groupDoc(3)}
          />
        </div>
      );
    }
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

  private handleOverlayClicked = (context: string) => {
    const { groupId, setFocusedGroupUser } = this.props;
    const groupUser = this.userByContext[context];
    const toggleContext = (state: IState) => context === state.toggledContext ? null : context;
    const toggledContext = toggleContext(this.state);
    this.setState(state => ({ toggledContext: toggleContext(state) }));
    if (groupUser) {
      const event = toggledContext ? LogEventName.DASHBOARD_SELECT_STUDENT : LogEventName.DASHBOARD_DESELECT_STUDENT;
      Logger.log(event, {groupId, studentId: groupUser.user.id});
    }
    if (setFocusedGroupUser) {
      const focusedGroupUser = toggledContext ? groupUser?.user : undefined;
      setFocusedGroupUser(focusedGroupUser);
    }
  }
}
