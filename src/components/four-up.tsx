import classNames from "classnames";
import { clone, debounce } from "lodash";
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
import { FourUpOverlayComponent } from "./four-up-overlay";
import { getGroupUsers } from "../models/document/document-utils";
import { Logger } from "../lib/logger";
import { LogEventName } from "../lib/logger-types";
import FourUpIcon from "../clue/assets/icons/4-up-icon.svg";

import "./four-up.sass";

interface IProps extends IBaseProps {
  userId?: string;
  groupId?: string;
  isGhostUser?: boolean;
  toggleable?: boolean;
  documentViewMode?: DocumentViewMode;
  selectedSectionId?: string | null;
  viaTeacherDashboard?: boolean;
  viaStudentGroupView?: boolean;
  focusedUserContext?: string;
  setFocusedGroupUser?: (focusedGroupUser?: GroupUserModelType) => void;
}

interface IState {
  toggledContextMap: Record<string, string | undefined>
}

export interface FourUpUser {
  user: GroupUserModelType;
  doc?: DocumentModelType;
  context: string;
}

interface ContextUserMap {
  [key: string]: FourUpUser | undefined;
}

// The bottom of the four-up view is covered by the border of the bottom nav, so this lost height must be considered
export const BORDER_SIZE = 4;

const indexToCornerLabel = [
  "four-up-nw",
  "four-up-ne",
  "four-up-se",
  "four-up-sw"
] as const;

const indexToCornerClass = [
  "north-west",
  "north-east",
  "south-east",
  "south-west"
] as const;

const indexToLocation = [
  "nw", "ne", "se", "sw"
] as const;

function getQuadrant(groupUserIndex: number) {
  if (groupUserIndex < 0 || groupUserIndex > 3) return undefined;
  return indexToCornerLabel[groupUserIndex];
}


//TODO:  #1 activeGroupId - is not being set, G1, G2, G3 set to subTab
//       #2 get whole selection highlighting commenting enabled again when in workspaces mode

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
    this.grid = FourUpGridModel.create({
      splitterSize: 3,
    });
  }

  public componentDidMount() {
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === this.container) {
          // debounce to prevent resize loops
          this.handleResizeDebounced(entry);
        }
      }
    });
    this.container && this.resizeObserver.observe(this.container);
  }

  public componentWillUnmount() {
    this.resizeObserver.disconnect();
  }

  private getFocusedUserQuadrant () {
    const {ui, groups} = this.stores;
    const docKey = this.props.groupId && ui.tabs.get("student-work")?.openDocuments.get(this.props.groupId);
    if (docKey){
      const group = groups.getGroupById(this.props.groupId);
      const focusedGroupUser = group?.users.find(obj => obj.problemDocument?.key === docKey);
      const focusedUserIndex = focusedGroupUser && group?.sortedUsers.indexOf(focusedGroupUser);
      return getQuadrant(focusedUserIndex ?? -1);
    }
    else {
      return undefined;
    }
  }



  public render() {
    const {focusedUserContext, documentViewMode, viaStudentGroupView,
        userId, groupId, isGhostUser, toggleable, ...others } = this.props;


    const {width, height} = this.grid;
    const nwCell = this.grid.cells[CellPositions.NorthWest];
    const neCell = this.grid.cells[CellPositions.NorthEast];
    const seCell = this.grid.cells[CellPositions.SouthEast];
    const swCell = this.grid.cells[CellPositions.SouthWest];
    const toggledStyle = {top: 0, left: 0, width, height};

    const scaleStyle = (cell: FourUpGridCellModelType) => {
      const transform = `scale(${focusedUserQuadrant ? 1 : cell.scale})`;
      return {width, height, transform, transformOrigin: "0 0"};
    };

    const { groups, documents } = this.stores;
    const groupUsers = getGroupUsers(userId, groups, documents, groupId, documentViewMode);

    // save reference to use for the username display in this render and logger in #handleOverlayClicked
    this.userByContext = {
      "four-up-nw": groupUsers[0],
      "four-up-ne": groupUsers[1],
      "four-up-se": groupUsers[2],
      "four-up-sw": groupUsers[3],
    };

    const focusedUserQuadrant = focusedUserContext || this.getFocusedUserQuadrant();

    const indexToStyle = [
      focusedUserQuadrant ? toggledStyle : {top: 0, left: 0, width: nwCell.width, height: nwCell.height},
      focusedUserQuadrant ? toggledStyle : {top: 0, left: neCell.left, right: 0, height: neCell.height},
      focusedUserQuadrant ? toggledStyle : {top: seCell.top, left: seCell.left, right: 0, bottom: 0},
      focusedUserQuadrant ? toggledStyle : {top: swCell.top, left: 0, width: swCell.width, bottom: 0}
    ];

    const groupDoc = (index: number) => {
      return groupUsers[index] && groupUsers[index].doc;
    };

    const hideCanvas = (index: number) => {
      // Index 0 is never hidden, I'm not sure why
      if (index === 0) {
        return false;
      }
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

    const renderCanvas = (cornerIndex: number, overlay?: React.ReactNode) => {
      const cornerLabel = indexToCornerLabel[cornerIndex];
      const cell = this.grid.cells[cornerIndex];
      const document = groupDoc(cornerIndex);
      // Only the user's document is editable, but not if they're a ghost user
      // (Ghost users do not own group documents and cannot edit others')
      const readOnly = cornerIndex !== 0 || isGhostUser;
      return <CanvasComponent context={cornerLabel} scale={cellScale(cell, cornerLabel)}
                       readOnly={readOnly}
                       document={document} overlayMessage={canvasMessage(document)}
                       showPlayback={focusedUserQuadrant === cornerLabel} {...others} overlay={overlay} />;
    };

    // Double the scale if the cell is focused
    const cellScale =
      (cell: FourUpGridCellModelType, corner: string) => (focusedUserQuadrant === corner ? 2 : 1) * cell.scale;

    const memberName = (context: string) => {
      const groupUser = this.userByContext[context];
      const isToggled = context === focusedUserQuadrant;
      if (groupUser) {
        const { name: fullName, initials } = groupUser.user;
        const className = classNames("member", {"member-centered": isToggled && !viaStudentGroupView},
                                     {"in-student-group-view": isToggled && viaStudentGroupView});

        const name = isToggled ? fullName : initials;
        return (
          isToggled && viaStudentGroupView
            ? //pass an undefined context to handleOverlayClick to null out selected quadrant
              <button className="restore-fourup-button" onClick={()=>this.handleFourUpClick()}>
                <FourUpIcon /> 4-Up
              </button>
            : <div className={className} title={fullName} onClick={()=>this.handleOverlayClick(context)}>
                  {name}
              </div>
        );
      }
    };

    const renderCorner = (cornerIndex: number) => {
      const cornerLabel = indexToCornerLabel[cornerIndex];
      const cell = this.grid.cells[cornerIndex];
      const document = groupDoc(cornerIndex);

      const overlay = toggleable &&
        <FourUpOverlayComponent
          context={cornerLabel}
          style={{top: 0, left: 0, width: "100%", height: "100%"}}
          onClick={this.handleOverlayClick}
          documentViewMode={documentViewMode}
          document={document}
        />;

      // If we are looking at a specific student, toggledContext equals the cornerLabel
      // of that student. When we are looking at a specific student we need the overlay
      // to be inside of the Canvas so the canvas can put its history UI on top of the
      // overlay. When we are not looking at a specific student we need the overlay
      // to be unscaled and have dimensions based on the grid so its clickable area
      // covers the whole quadrant of the grid not just the area of the canvas
      const overlayInsideOfCanvas = focusedUserQuadrant && overlay;
      const overlayOnTopOfCanvas = !focusedUserQuadrant && overlay;

      return !focusedUserQuadrant || (focusedUserQuadrant === cornerLabel)
        ? <div key={cornerIndex} className={classNames("canvas-container", indexToCornerClass[cornerIndex])}
              style={indexToStyle[cornerIndex]}>
            <div className="canvas-scaler" style={scaleStyle(cell)}>
              {hideCanvas(cornerIndex)
                ? this.renderUnshownMessage(groupUsers[cornerIndex], indexToLocation[cornerIndex])
                : renderCanvas(cornerIndex, overlayInsideOfCanvas)}
            </div>
            {overlayOnTopOfCanvas}
            {memberName(cornerLabel)}
          </div>
        : null;
    };

    return (
      <div className="four-up" ref={(el) => this.container = el}>
        { [0,1,2,3].map(cornerIndex => renderCorner(cornerIndex)) }
        {!focusedUserQuadrant ? this.renderSplitters() : null}
      </div>
    );
  }

  private renderSplitters() {
    return (
      <>
        <div
          className="horizontal splitter" data-test="4up-horizontal-splitter"
          style={{top: this.grid.hSplitter, height: this.grid.splitterSize}}
          onMouseDown={this.handleHSplitter}
        />
        <div
          className="vertical splitter" data-test="4up-vertical-splitter"
          style={{left: this.grid.vSplitter, width: this.grid.splitterSize}}
          onMouseDown={this.handleVSplitter}
        />
        <div
          className="center" data-test="4up-center"
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

  private renderUnshownMessage = (groupUser: FourUpUser, location: "nw" | "ne" | "se" | "sw") => {
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
  };

  private handleResizeDebounced = debounce((entry: ResizeObserverEntry) => {
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
  }, 100);

  private handleHSplitter = (e: React.MouseEvent<HTMLDivElement>) => {
    this.handleSplitters(e, true, false);
  };

  private handleVSplitter = (e: React.MouseEvent<HTMLDivElement>) => {
    this.handleSplitters(e, false, true);
  };

  private handleCenter = (e: React.MouseEvent<HTMLDivElement>) => {
    this.handleSplitters(e, true, true);
  };

  private handleSplitters = (e: React.MouseEvent<HTMLDivElement>, allowHorizontal: boolean, allowVertical: boolean) => {
    const start = {
      hSplitter: this.grid.hSplitter,
      vSplitter: this.grid.vSplitter,
      x: e.clientX,
      y: e.clientY,
    };

    const getSplittersFromEvent = (event: MouseEvent) => {
      return {
        hSplitter: allowHorizontal ? start.hSplitter + (event.clientY - start.y) : start.hSplitter,
        vSplitter: allowVertical ? start.vSplitter + (event.clientX - start.x) : start.vSplitter,
      };
    };

    const handleMouseMove = (moveE: MouseEvent) => {
      this.grid.update(getSplittersFromEvent(moveE));
    };

    const handleMouseUp = (upE: MouseEvent) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const _start = { hSplitter: start.hSplitter, vSplitter: start.vSplitter };
      const end = getSplittersFromEvent(upE);
      Logger.log(LogEventName.VIEW_FOUR_UP_RESIZED, { start: _start, end });
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  private handleFourUpClick = () => {
    const { ui } = this.stores;
    const { groupId } = this.props;
    groupId && ui.closeSubTabDocument("student-work",  groupId);
  };

  private handleOverlayClick = (context?: string) => {
    const { ui } = this.stores;
    const { groupId } = this.props;
    const groupUser = context ? this.userByContext[context] : undefined;
    const toggledContext = this.getFocusedUserQuadrant();

    if (groupUser && groupUser.doc && groupId) {
      if (toggledContext){
        ui.closeSubTabDocument("student-work", groupId);
      } else {
        ui.openSubTabDocument("student-work", groupId, groupUser.doc.key); //sets the focus document;
      }
    }

    if (groupUser) {
      const event = toggledContext ? LogEventName.DASHBOARD_SELECT_STUDENT :
                                          LogEventName.DASHBOARD_DESELECT_STUDENT;
      Logger.log(event, {groupId, studentId: groupUser.user.id});
    }
  };
}
