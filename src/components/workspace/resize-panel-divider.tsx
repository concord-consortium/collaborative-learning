import classNames from "classnames";
import { debounce } from "lodash";
import React, { useState } from "react";
import DragThumbnailIcon from "../../assets/drag-thumb-icon.svg";
import ExpandIndicatorIcon from "../../assets/expand-indicator-icon.svg";
import { kDividerMax, kDividerMin } from "../../models/stores/ui-types";
import "./resize-panel-divider.scss";

interface IProps {
  isResourceExpanded: boolean;
  dividerPosition: number;
  showExpanders: boolean;
  onDividerClick: () => void;
  toggleShowExpanders: (show?: boolean) => void;
  onExpandWorkspace: () => void;
  onExpandResources: () => void;
}

interface IExpanderProps {
  dividerPosition: number;
  direction: string;
  shown: boolean;
  toggleShowExpanderHandle: (show?: boolean)=> void;
  onExpand: () => void;
}

const ExpandHandle: React.FC<IExpanderProps> = ({dividerPosition, direction, shown,
  toggleShowExpanderHandle, onExpand}) => {
  // eslint-disable-next-line object-shorthand
  const expanderClass = classNames("expand-handle", direction, {"shown": shown,
                                   "disabled": dividerPosition === kDividerMin});
  const handleExpandHandleClick = () => {
    toggleShowExpanderHandle();
    onExpand();
  };
  return (
    <div className={expanderClass} onClick={handleExpandHandleClick}>
        <ExpandIndicatorIcon className={`expand-indicator ${direction}`}/>
    </div>
  );
};

export const ResizePanelDivider: React.FC <IProps> =
  ({dividerPosition, showExpanders, onDividerClick, toggleShowExpanders, onExpandWorkspace, onExpandResources}) => {
    const dividerMinLeftOffset = 39.5;
    // const dividerMidLeftOffset = 21;
    const dividerMaxLeftOffset = 22;
    const tabWidth = 45;
    const hideDivider = dividerPosition === kDividerMin || dividerPosition === kDividerMax;
    const dividerPositionStyle = dividerPosition  === kDividerMin
                                  ? {left: dividerMinLeftOffset}
                                  : dividerPosition === kDividerMax
                                      ? {left: `calc(${dividerPosition}% - ${tabWidth}px - ${dividerMaxLeftOffset}px)`}
                                      : {left: `calc(${dividerPosition}%)`};
    const classes = classNames("resize-panel-divider");

    const debouncedHandleDividerEnter = debounce(() => toggleShowExpanders(true), 500);

    return (
      hideDivider
      ? null
      : <div className={`divider-container ${showExpanders ? "show-expanders" : ""}`}>
          {showExpanders
            ? <div className="expand-handles-container" onMouseLeave={()=>toggleShowExpanders(false)}>
                <ExpandHandle dividerPosition={dividerPosition} direction={"left"} shown={showExpanders}
                              toggleShowExpanderHandle={toggleShowExpanders} onExpand={onExpandWorkspace} />
                <ExpandHandle dividerPosition={dividerPosition} direction={"right"} shown={showExpanders}
                              onExpand={onExpandResources} toggleShowExpanderHandle={toggleShowExpanders}/>
              </div>
            : <div className={classes} style={dividerPositionStyle}>
                <div className="divider" onMouseEnter={debouncedHandleDividerEnter} onClick={()=>onDividerClick()}/>
                <DragThumbnailIcon className="drag-thumbnail" onClick={()=>onDividerClick()}
                    onMouseEnter={()=>toggleShowExpanders(true)} />
              </div>
          }
        </div>
    );
};
