import classNames from "classnames";
import React, { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import DragThumbnailIcon from "../../assets/drag-thumb-icon.svg";
import { kDividerHalf, kDividerMax, kDividerMin } from "../../models/stores/ui-types";
import { ResourcesExpander } from "./resources-expander";
import { WorkspaceExpander } from "./workspace-expander";

import "./resize-panel-divider.scss";

interface IProps {
}

export const ResizePanelDivider: React.FC <IProps> = observer(function ResizePanelDivider() {
    const stores = useStores();
    const {
      ui: { activeNavTab, dividerPosition, problemWorkspace, setDividerPosition }
    } = stores;
    const [showExpanders, setShowExpanders] = useState(false);

    const inCenter = dividerPosition === kDividerHalf;
    const reallyShowExpanders = !inCenter || showExpanders;

    const handleExpandWorkspace = () => {
      if (dividerPosition === kDividerMax) {
        setDividerPosition(kDividerHalf);
      } else if (dividerPosition === kDividerHalf) {
        setDividerPosition(kDividerMin);
      }
      clearHoveringTimeout();
      setShowExpanders(false);
    };

    const handleExpandResources = () => {
      if (dividerPosition === kDividerMin) {
        setDividerPosition(kDividerHalf);
      } else if (dividerPosition === kDividerHalf) {
        setDividerPosition(kDividerMax);
      }
      clearHoveringTimeout();
      setShowExpanders(false);
    };

    const hoveringTimeout = useRef<number | undefined>(undefined);
    const hovering = useRef<boolean>(false);
    const handleDividerEnter = () => {
      if (inCenter && !showExpanders && !hoveringTimeout.current) {
        hovering.current = true;
        hoveringTimeout.current = window.setTimeout(() => {
          hoveringTimeout.current = undefined;
          if (hovering.current) {
            setShowExpanders(true);
          }
          hovering.current = false;
        }, 500);
      }
    };
    const handleDividerLeave = () => {
      setShowExpanders(false);
      clearHoveringTimeout();
    };
    const handleDividerClick = () => {
      if (inCenter && !showExpanders) {
        setShowExpanders(true);
        clearHoveringTimeout();
      }
    };
    const clearHoveringTimeout = () => {
      hovering.current = false;
      window.clearTimeout(hoveringTimeout.current);
      hoveringTimeout.current = undefined;
    };

    const positionClass = `divider-position-${dividerPosition}`;
    // TODO: rename the class names so the top level one is resize-panel-divider since
    // that is the name of the component
    return (
      <div className={classNames("divider-container", positionClass, {"show-expanders": reallyShowExpanders})}
          onMouseEnter={handleDividerEnter} onMouseLeave={handleDividerLeave} onClick={()=>handleDividerClick()}>
        <WorkspaceExpander onExpandWorkspace={handleExpandWorkspace} workspaceType={problemWorkspace.type} />
        <div className="resize-panel-divider" >
          <div className="divider" />
          <DragThumbnailIcon className="drag-thumbnail" onClick={()=>setShowExpanders(true)}
              onMouseEnter={()=>setShowExpanders(true)} />
        </div>
        <ResourcesExpander onExpandResources={handleExpandResources} resourceType={activeNavTab}/>
      </div>
    );
});
