import classNames from "classnames";
import { debounce } from "lodash";
import { observer, inject } from "mobx-react";
import React from "react";
import ResizeObserver from "resize-observer-polyfill";
import { BaseComponent, IBaseProps } from "./base";
import { CanvasComponent } from "./document/canvas";
import { DocumentViewMode } from "./document/document";
import { DocumentModelType } from "../models/document/document";
import { GroupModelType, GroupUserModelType } from "../models/stores/groups";
import {
  CellPositions, FourUpGridCellModelType, FourUpGridModel, FourUpGridModelType
} from "../models/view/four-up-grid";
import { Logger } from "../lib/logger";
import { LogEventName } from "../lib/logger-types";
import ThumbnailBookmark from "../assets/thumbnail-bookmark-icon.svg";
import { DocumentToolbar } from "./document/document-toolbar";
import { IToolbarButtonModel } from "../models/tiles/toolbar-button";

import "./four-up.scss";

interface IProps extends IBaseProps {
  group: GroupModelType;
  isGhostUser?: boolean;
  documentViewMode?: DocumentViewMode;
  selectedSectionId?: string | null;
  viaTeacherDashboard?: boolean;
  viaStudentGroupView?: boolean;
}

interface IState {
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

export function getQuadrant(groupUserIndex: number) {
  if (groupUserIndex < 0 || groupUserIndex > 3) return undefined;
  return indexToCornerLabel[groupUserIndex];
}

/**
 * When the four-up is used in the dashboard it can be showing live student
 * problem documents or published documents. In the case of published documents
 * we use a fake tab called student-work-published to keep track of which
 * documents are open. These open documents correspond the focused quadrant of
 * the four-up view
 *
 * @returns
 */
export function getUIStudentWorkTab(mode?: DocumentViewMode) {
  return mode === DocumentViewMode.Published ? "student-work-published" : "student-work";
}

export function getUserDocument(groupUser: GroupUserModelType | undefined, mode: DocumentViewMode | undefined) {
  if (mode === DocumentViewMode.Published) {
    return groupUser?.lastPublishedProblemDocument;
  } else {
    return groupUser?.problemDocument;
  }
}

export function getFocusedGroupUser(group: GroupModelType | undefined, openDocId: string | undefined,
  mode: DocumentViewMode | undefined) {
  if (!openDocId || !group) return undefined;

  return group?.activeUsers.find(obj => {
    const userDoc = getUserDocument(obj, mode);
    return userDoc?.key === openDocId;
  });
}

/**
 * The state of the currently focused group member is stored in `stores.ui.tabs`. This is the
 * case even when a student is running CLUE and they show the FourUp view to see their group
 * member's work. The default tab id is "student-work", if the documentViewMode is Published
 * then the tab id is "student-work-published".
 */
@inject("stores")
@observer
export class FourUpComponent extends BaseComponent<IProps, IState> {
  private grid: FourUpGridModelType;
  private container: HTMLDivElement | null;
  private resizeObserver: ResizeObserver;
  private roIsInitialized = false;

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

  private get tabName() {
    return getUIStudentWorkTab(this.props.documentViewMode);
  }

  /**
   * When the four-up is used in the dashboard it can be showing published
   * documents. In that case we use a fake tab called student-work-published
   * to keep track of which documents are open. This corresponds the focused
   * user.
   *
   * @returns
   */
  private get tabUIModel() {
    const { persistentUI } = this.stores;
    return persistentUI.tabs.get(this.tabName);
  }

  private getFocusedUserDocKey() {
    const { group } = this.props;
    return this.tabUIModel?.getDocumentGroup(group.id)?.primaryDocumentKey;
  }

  private getFocusedGroupUser() {
    const { group } = this.props;
    const docKey = this.getFocusedUserDocKey();
    return group.activeUsers.find(obj => docKey && this.getGroupUserDoc(obj)?.key === docKey);
  }

  private getGroupUserDoc(groupUser?: GroupUserModelType) {
    const { documentViewMode } = this.props;
    return getUserDocument(groupUser, documentViewMode);
  }

  public render() {
    const { documentViewMode, viaStudentGroupView,
      group, isGhostUser, ...others } = this.props;

    const { width, height } = this.grid;
    const nwCell = this.grid.cells[CellPositions.NorthWest];
    const neCell = this.grid.cells[CellPositions.NorthEast];
    const seCell = this.grid.cells[CellPositions.SouthEast];
    const swCell = this.grid.cells[CellPositions.SouthWest];
    const toggledStyle = { top: 0, left: 0, width, height };

    const scaleStyle = (cell: FourUpGridCellModelType) => {
      const transform = `scale(${focusedGroupUser ? 1 : cell.scale})`;
      return { width, height, transform, transformOrigin: "0 0" };
    };

    // We are using this as a lookup table, so its possible the index being looked
    // up won't exist.
    const groupUsers: Array<GroupUserModelType | undefined> = group.sortedUsers;

    const focusedGroupUser = this.getFocusedGroupUser();

    const indexToStyle = [
      focusedGroupUser ? toggledStyle : { top: 0, left: 0, width: nwCell.width, height: nwCell.height },
      focusedGroupUser ? toggledStyle : { top: 0, left: neCell.left, right: 0, height: neCell.height },
      focusedGroupUser ? toggledStyle : { top: seCell.top, left: seCell.left, right: 0, bottom: 0 },
      focusedGroupUser ? toggledStyle : { top: swCell.top, left: 0, width: swCell.width, bottom: 0 }
    ];

    const isFocused = (groupUser?: GroupUserModelType) => focusedGroupUser && focusedGroupUser === groupUser;

    const groupDoc = (index: number) => this.getGroupUserDoc(groupUsers[index]);

    const hideCanvas = (index: number) => {
      // Index 0 is never hidden, I'm not sure why
      if (index === 0) {
        return false;
      }
      const doc = groupDoc(index);
      // Note if the group size is less than 4, then groupUsers[x] will return undefined in some cases
      // so unopenedDoc will be undefined
      const unopenedDoc = groupUsers[index] && !doc;
      // Don't hide anything from ghost users, and treat unopened documents as private by default
      // If unopenedDoc is undefined and doc is undefined then result is undefined so hideCanvas is
      // false
      const result = !isGhostUser && (unopenedDoc || doc && doc.visibility === "private");
      return result;
    };

    const canvasMessage = (document?: DocumentModelType) => {
      if (!document && (documentViewMode === DocumentViewMode.Published)) {
        return "Not Published";
      }
    };

    const renderCanvas = (cornerIndex: number) => {
      const cornerLabel = indexToCornerLabel[cornerIndex];
      const groupUser = groupUsers[cornerIndex];
      const cell = this.grid.cells[cornerIndex];
      const document = groupDoc(cornerIndex);
      // Only the user's document is editable, but not if they're a ghost user
      // (Ghost users do not own group documents and cannot edit others')
      const readOnly = cornerIndex !== 0 || !!isGhostUser;
      return <CanvasComponent
        context={cornerLabel}
        document={document}
        overlayMessage={canvasMessage(document)}
        readOnly={readOnly}
        scale={cellScale(cell, groupUser)}
        showPlayback={isFocused(groupUser)}
        {...others}
      />;
    };

    // Double the scale if the cell is focused
    const cellScale = (cell: FourUpGridCellModelType, groupUser?: GroupUserModelType) =>
      (isFocused(groupUser) ? 2 : 1) * cell.scale;

    const memberName = (groupUser?: GroupUserModelType) => {
      const userFocused = isFocused(groupUser);
      if ((userFocused && viaStudentGroupView) || !groupUser) {
        return null;
      }

      const { name: fullName, initials } = groupUser;
      const className = classNames("member", {"member-centered": userFocused && !viaStudentGroupView});
      const name = userFocused ? fullName : initials;

      return (
        <div className={className} title={fullName} onClick={() => this.handleOverlayClick(groupUser)}>
          {name}
        </div>
      );
    };

    const renderStar = (document?: DocumentModelType) => {
      const { user, bookmarks } = this.stores;
      if (!document || (documentViewMode !== DocumentViewMode.Published)) {
        return;
      }

      const handleStarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (document) {
          bookmarks.toggleUserBookmark(document.key, user.id);
        }
      };

      const isStarred = bookmarks.isDocumentBookmarkedByUser(document.key, user.id);
      return (
        <div className="icon-holder" onClick={handleStarClick}>
          <svg className={"icon-star " + (isStarred ? "starred" : "")} >
            <ThumbnailBookmark />
          </svg>
        </div>
      );
    };

    const renderCorner = (cornerIndex: number) => {
      const cell = this.grid.cells[cornerIndex];
      const document = groupDoc(cornerIndex);
      const groupUser = groupUsers[cornerIndex];

      return !focusedGroupUser || isFocused(groupUser)
        ? <div key={cornerIndex} className={classNames("canvas-container", indexToCornerClass[cornerIndex])}
            style={indexToStyle[cornerIndex]}>
            <div className="canvas-scaler" style={scaleStyle(cell)}>
              {hideCanvas(cornerIndex)
                ? this.renderUnshownMessage(groupUser, indexToLocation[cornerIndex])
                : renderCanvas(cornerIndex)}
            </div>
            {memberName(groupUser)}
            {renderStar(document)}
          </div>
        : null;
    };

    const toolbarDoc = this.getGroupUserDoc(focusedGroupUser);
    const disabledToolIds: string[] = [];
    if (!toolbarDoc) {
      disabledToolIds.push(...["selectAll", "copyToDocument", "copyToWorkspace"]);
    }
    if (!focusedGroupUser) {
      disabledToolIds.push("fourUp");
      disabledToolIds.push("togglePlayback");
    }

    return (
      <div className="four-up">
        <div className="left-side-container">
          <DocumentToolbar
            document={toolbarDoc}
            toolbar={this.stores.appConfig.myResourcesToolbar({ show4Up: true, showPlayback: true })}
            disabledToolIds={disabledToolIds}
            onToolClicked={this.handleToolClicked}
            />
          <div className="canvas-separator" />
        </div>
        <div className="inner-canvas-area" ref={(el) => this.container = el}>
          {[0, 1, 2, 3].map(cornerIndex => renderCorner(cornerIndex))}
          {!focusedGroupUser ? this.renderSplitters() : null}
        </div>
      </div>
    );
  }

  private renderSplitters() {
    return (
      <>
        <div
          className="horizontal splitter" data-test="4up-horizontal-splitter"
          style={{ top: this.grid.hSplitter, height: this.grid.splitterSize }}
          onMouseDown={this.handleHSplitter}
        />
        <div
          className="vertical splitter" data-test="4up-vertical-splitter"
          style={{ left: this.grid.vSplitter, width: this.grid.splitterSize }}
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

  private renderUnshownMessage = (groupUser: GroupUserModelType | undefined,
    location: "nw" | "ne" | "se" | "sw") => {
    const groupUserName = groupUser ? groupUser.name : "User";
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
    const { width, height } = entry.contentRect;
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

  private handleToolClicked = (tool: IToolbarButtonModel) => {
    if (tool.id === "fourUp") {
      const { group } = this.props;
      this.tabUIModel?.getDocumentGroup(group.id)?.closePrimaryDocument();

      Logger.log(LogEventName.TOOLBAR_FOUR_UP_TOOL);

      // prevent the default tool action
      return true;
    }
  };

  private handleOverlayClick = (groupUser?: GroupUserModelType) => {
    const { group } = this.props;
    const focusedUser = this.getFocusedGroupUser();
    const document = this.getGroupUserDoc(groupUser);
    const { persistentUI } = this.stores;

    if (groupUser && document) {
      const logInfo = { groupId: group.id, studentId: groupUser.id };
      if (focusedUser) {
        // This needs to create the tabModel if it doesn't exist so we can use this.tabModel
        persistentUI.closeDocumentGroupPrimaryDocument(this.tabName, group.id);
        Logger.log(LogEventName.DASHBOARD_DESELECT_STUDENT, logInfo);
      } else {
        // This needs to create the tabModel if it doesn't exist so we can use this.tabModel
        persistentUI.setDocumentGroupPrimaryDocument(this.tabName, group.id, document.key); //sets the focus document;
        Logger.log(LogEventName.DASHBOARD_SELECT_STUDENT, logInfo);
      }
    }
  };
}
