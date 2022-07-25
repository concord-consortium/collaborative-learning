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
  onExpandWorkspace: () => void;
  onExpandResources: () => void;
}

interface IExpanderProps {
  dividerPosition: number;
  direction: string;
  shown: boolean;
  toggleShowExpanders: (show?: boolean)=> void;
  onExpand: () => void;
}

const ExpandHandle: React.FC<IExpanderProps> = ({dividerPosition, direction, shown, toggleShowExpanders, onExpand}) => {
  // eslint-disable-next-line object-shorthand
  const expanderClass = classNames("expand-handle", direction, {"shown": shown,
                                   "disabled": dividerPosition === kDividerMin});
  const handleExpandHandleClick = () => {
    toggleShowExpanders();
    onExpand();
  };
  return (
    <div className={expanderClass} onClick={handleExpandHandleClick}>
        <ExpandIndicatorIcon className={`expand-indicator ${direction}`}/>
    </div>
  );
};

export const ResizePanelDivider: React.FC <IProps> =
  ({dividerPosition, onExpandWorkspace, onExpandResources}) => {
    // const ui = useUIStore();
    const [showExpanders, setShowExpanders] = useState(false);
    // const showExpanders = ui.showPaneSliderControls;
    // const setShowExpanders = ui.toggleShowPaneSliderControls;
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
    // const classes = classNames("resize-panel-divider", {
    //                             "divider-min": dividerPosition  === kDividerMin,
    //                             "divider-max": dividerPosition === kDividerMax });
    const classes = classNames("resize-panel-divider");

    const handleDividerClick = () => {
      // ui.toggleShowPaneSliderControls(!ui.showPaneSliderControls);
      setShowExpanders(!showExpanders);
    };

    const debouncedHandleDividerEnter = debounce(() => setShowExpanders(true), 500);

    const toggleShowExpanders = (show?:boolean) => {
      // ui.toggleShowPaneSliderControls(!ui.showPaneSliderControls);
      setShowExpanders(show || !showExpanders);
    };

    return (
      hideDivider
      ? null
      : showExpanders
          ? <div className="expand-handles-container" onMouseLeave={()=>toggleShowExpanders(false)}>
              <ExpandHandle dividerPosition={dividerPosition} direction={"left"} shown={showExpanders}
                            toggleShowExpanders={toggleShowExpanders} onExpand={onExpandWorkspace} />
              <ExpandHandle dividerPosition={dividerPosition} direction={"right"} shown={showExpanders}
                            onExpand={onExpandResources} toggleShowExpanders={toggleShowExpanders}/>
            </div>
          : <div className={classes} style={dividerPositionStyle}>
              <div className="divider" onMouseEnter={debouncedHandleDividerEnter} onClick={()=>handleDividerClick()}/>
              <DragThumbnailIcon className="drag-thumbnail" onClick={()=>handleDividerClick()}
                  onMouseEnter={()=>setShowExpanders(true)} />
            </div>
    );
};
