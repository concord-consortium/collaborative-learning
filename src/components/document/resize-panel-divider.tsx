import classNames from "classnames";
import React, { useState } from "react";
import { debounce } from "lodash";
import DragThumbnailIcon from "../../assets/drag-thumb-icon.svg";
import LeftDragIcon from "../../assets/left-drag.svg";
import RightDragIcon from "../../assets/right-drag.svg";
import ExpandIndicatorIcon from "../../assets/expand-indicator-icon.svg";
import { kDividerMax, kDividerMin } from "../../models/stores/ui-types";
import "./resize-panel-divider.scss";

interface IProps {
  isResourceExpanded: boolean;
  dividerPosition: number;
  onExpandWorkspace: () => void;
  onExpandResources: () => void;
}

interface IExpanderProps {
  dividerPosition: number;
  direction: string;
  shown: boolean;
  toggleShowExpanders: ()=> void;
  onExpand: () => void;
}

const ExpandHandle: React.FC<IExpanderProps> = ({dividerPosition, direction, shown, toggleShowExpanders, onExpand}) => {
  // eslint-disable-next-line object-shorthand
  const expanderClass = classNames("expand-handle", direction, {"shown": shown},
                          {"disabled": dividerPosition === kDividerMin});
  const handleExpandHandleClick = () => {
    toggleShowExpanders();
    onExpand();
  };
  return (
    // <div className={expanderClass} onClick={() => onExpand()}>
    <div className={expanderClass} onClick={handleExpandHandleClick}>
        <ExpandIndicatorIcon className={`expand-indicator ${direction}`}/>
    </div>
  );
};

export const ResizePanelDivider: React.FC <IProps> =
  ({dividerPosition, onExpandWorkspace, onExpandResources}) => {
    const [showExpanders, setShowExpanders] = useState(false);
    const dividerMinLeftOffset = 39.5;
    const dividerMidLeftOffset = 21;
    const dividerMaxLeftOffset = 22;
    const tabWidth = 45;
    const showDivider = dividerPosition === kDividerMin || dividerPosition === kDividerMax;
    const dividerPositionStyle = dividerPosition  === kDividerMin
                                  ? {left: dividerMinLeftOffset}
                                  : dividerPosition === kDividerMax
                                      ? {left: `calc(${dividerPosition}% - ${tabWidth}px - ${dividerMaxLeftOffset}px)`}
                                      : {left: `calc(${dividerPosition}%)`};
    const classes = classNames("resize-panel-divider", {
                                "divider-min": dividerPosition  === kDividerMin,
                                "divider-max": dividerPosition === kDividerMax });

    const handleDividerClick = () => {
      setShowExpanders(!showExpanders);
    };

    const debouncedHandleDividerEnter = debounce(() => setShowExpanders(true), 500);

    const toggleShowExpanders = () => {
      setShowExpanders(!showExpanders);
    };

    return (
      showDivider
      ? null
      : <div className={classes} style={dividerPositionStyle}>
          { showExpanders
            ? <div className="expand-handles-container">
                <ExpandHandle dividerPosition={dividerPosition} onExpand={onExpandWorkspace}
                                  direction={"left"} shown={showExpanders} toggleShowExpanders={toggleShowExpanders}/>
                <ExpandHandle dividerPosition={dividerPosition} onExpand={onExpandResources}
                              direction={"right"} shown={showExpanders} toggleShowExpanders={toggleShowExpanders}/>
              </div>
            : <>
                <div className="divider" onMouseEnter={debouncedHandleDividerEnter} onClick={()=>handleDividerClick()}/>
                <DragThumbnailIcon className="drag-thumbnail" onClick={()=>handleDividerClick()}
                    onMouseEnter={()=>setShowExpanders(true)} />
              </>
          // <div className="drag-handles">
          //   {!(dividerPosition === kDividerMin) &&

          //     <LeftDragIcon className={`drag-left-handle ${dividerPosition === kDividerMin ? "disabled" : "" }`}
          //                   onClick={() => onExpandWorkspace()} />
          //   }
          //   {!(dividerPosition === kDividerMax) &&

          //     <RightDragIcon className={`drag-right-handle ${dividerPosition === kDividerMax ? "disabled" : ""}`}
          //                   onClick={() => onExpandResources()} />
          //   }
          // </div>
          }
        </div>
    );
};
