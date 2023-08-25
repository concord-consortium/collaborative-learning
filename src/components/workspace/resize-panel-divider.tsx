import classNames from "classnames";
import React, { useRef } from "react";
import DragThumbnailIcon from "../../assets/drag-thumb-icon.svg";
import ExpandIndicatorIcon from "../../assets/expand-indicator-icon.svg";
import { kDividerMax, kDividerMin } from "../../models/stores/ui-types";
import "./resize-panel-divider.scss";
import { ResourcesExpander } from "./resources-expander";
import { WorkspaceExpander } from "./workspace-expander";

interface IProps {
  isResourceExpanded: boolean;
  dividerPosition: number;
  showExpanders: boolean;
  onDividerClick: () => void;
  toggleShowExpanders: (show: boolean) => void;
  onExpandWorkspace: () => void;
  onExpandResources: () => void;
}

// interface IExpanderProps {
//   dividerPosition: number;
//   direction: string;
//   shown: boolean;
//   toggleShowExpanderHandle: (show: boolean)=> void;
//   onExpand: () => void;
// }

// const ExpandHandle: React.FC<IExpanderProps> = ({dividerPosition, direction, shown,
//   toggleShowExpanderHandle, onExpand}) => {
//   // eslint-disable-next-line object-shorthand
//   const expanderClass = classNames("expand-handle", direction, {"shown": shown,
//                                    "disabled": dividerPosition === kDividerMin});
//   const handleExpandHandleClick = () => {
//     toggleShowExpanderHandle(false);
//     onExpand();
//   };
//   return (
//     <div className={expanderClass} onClick={handleExpandHandleClick}>
//       <ExpandIndicatorIcon className={`expand-indicator ${direction}`}/>
//     </div>
//   );
// };

export const ResizePanelDivider: React.FC <IProps> =
  ({dividerPosition, showExpanders, onDividerClick, toggleShowExpanders, onExpandWorkspace, onExpandResources}) => {
    const hideDivider = dividerPosition === kDividerMin || dividerPosition === kDividerMax;

    const hoveringTimeout = useRef<number | undefined>(undefined);
    const hovering = useRef<boolean>(false);
    const handleDividerEnter = () => {
      if (!hoveringTimeout.current) {
        hovering.current = true;
        hoveringTimeout.current = window.setTimeout(() => {
          hoveringTimeout.current = undefined;
          if (hovering.current) {
            toggleShowExpanders(true);
          }
          hovering.current = false;
        }, 500);
      }
    };
    const handleDividerLeave = () => {
      toggleShowExpanders(false);
      hovering.current = false;
      window.clearTimeout(hoveringTimeout.current);
      hoveringTimeout.current = undefined;
    };

    return (
      hideDivider
      ? null
      : <div className={`divider-container ${showExpanders ? "show-expanders" : ""}`}>
          {showExpanders
            ? <div className="expand-handles-container" onMouseLeave={handleDividerLeave}>
                {/*
                  TODO: need to fix the style when this is shown in the middle:
                  - border color,
                  - non-hover background
                  - hover background
                  - hide the text (or make it transparent so we can animate it)
                  TODO: need to update references in cypress tests for the .expand-handle
                  - it uses .expand-handle.left and .expand-handle.right
                  NOTE: it seems like toggleShowExpanders can be ignored it is way to force
                  a rerender of the divider which then passes the showExpanders prop down here.
                  However this will change. Even if it didn't change the hideDivider becomes
                  true when an expander is clicked, so there doesn't seem to be a need for this.
                */}
                <WorkspaceExpander onExpandWorkspace={onExpandWorkspace} workspaceType={""} />
                {/* <ExpandHandle dividerPosition={dividerPosition} direction={"left"} shown={showExpanders}
                              toggleShowExpanderHandle={toggleShowExpanders} onExpand={onExpandWorkspace} /> */}
                <ResourcesExpander onExpandResources={onExpandResources} resourceType={""}/>
                {/* <ExpandHandle dividerPosition={dividerPosition} direction={"right"} shown={showExpanders}
                              onExpand={onExpandResources} toggleShowExpanderHandle={toggleShowExpanders} /> */}
              </div>
            : <div className="resize-panel-divider" >
                <div className="divider" onMouseEnter={handleDividerEnter}
                      onMouseLeave={handleDividerLeave} onClick={()=>onDividerClick()}/>
                <DragThumbnailIcon className="drag-thumbnail" onClick={()=>onDividerClick()}
                    onMouseEnter={()=>toggleShowExpanders(true)} onMouseLeave={handleDividerLeave} />
              </div>
          }
        </div>
    );
};
