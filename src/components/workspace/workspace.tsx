import { observer } from "mobx-react";
import React, { useState } from "react";
import { IBaseProps } from "../base";
import { useStores } from "../../hooks/use-stores";
import { kDividerHalf, kDividerMax, kDividerMin } from "../../models/stores/ui-types";
import { DocumentWorkspaceComponent } from "../document/document-workspace";
import { ImageDragDrop } from "../utilities/image-drag-drop";
import { NavTabPanel } from "../navigation/nav-tab-panel";
import { CollapsedResourcesTab } from "../navigation/collapsed-resources-tab";
import { CollapsedWorkspaceTab } from "../document/collapsed-document-workspace-tab";
import { ResizePanelDivider } from "./resize-panel-divider";

import "./workspace.sass";

interface IProps extends IBaseProps {
}

export const WorkspaceComponent: React.FC<IProps> = observer((props) => {
  const { appConfig: { navTabs: navTabSpecs },
          teacherGuide,
          user: { isTeacher },
          ui: { activeNavTab, navTabContentShown, dividerPosition,
                workspaceShown, problemWorkspace, setDividerPosition }
        } = useStores();
   const [showExpanders, setShowExpanders] = useState(false);

  let imageDragDrop: ImageDragDrop;

  const handleDragOverWorkspace = (e: React.DragEvent<HTMLDivElement>) => {
    console.log("line 30: handleDragOverWorkSpace");
    imageDragDrop?.dragOver(e);
  };

  const toggleExpandWorkspace = () => {
    if (dividerPosition === kDividerMax) {
      setDividerPosition(kDividerHalf);
    } else if (dividerPosition === kDividerHalf) {
      setDividerPosition(kDividerMin);
    }
  };

  const toggleExpandResources = () => {
    if (dividerPosition === kDividerMin) {
      setDividerPosition(kDividerHalf);
    } else if (dividerPosition === kDividerHalf) {
      setDividerPosition(kDividerMax);
    }
  };

  const handleDividerClick = () => {
    setShowExpanders(!showExpanders);
  };

  const toggleShowExpanders = (show:boolean) => {
    setShowExpanders(show);
  };

  const renderNavTabPanel = () => {
    const studentTabs = navTabSpecs?.tabSpecs.filter(t => !t.teacherOnly);
    const teacherTabs = navTabSpecs?.tabSpecs.filter(t => (t.tab !== "teacher-guide") || teacherGuide);
    const tabsToDisplay = isTeacher ? teacherTabs : studentTabs;

    return (
      navTabContentShown
        ? <NavTabPanel
            tabs={tabsToDisplay}
            onDragOver={handleDragOverWorkspace}
            isResourceExpanded={navTabContentShown}
            isExpanderShown={showExpanders}
          />
        : <CollapsedResourcesTab
            onExpandResources={toggleExpandResources}
            resourceType={activeNavTab}
            isResourceExpanded={!navTabContentShown}
          />
    );
  };

  return (
    <div className="workspace">
      <div
        className="drag-handler"
        onDragOver={handleDragOverWorkspace}
      />
      {navTabSpecs.showNavPanel && renderNavTabPanel()}
      {navTabSpecs.showNavPanel && <ResizePanelDivider
        isResourceExpanded={navTabContentShown}
        dividerPosition={dividerPosition}
        showExpanders={showExpanders}
        onDividerClick={handleDividerClick}
        toggleShowExpanders={toggleShowExpanders}
        onExpandWorkspace={toggleExpandWorkspace}
        onExpandResources={toggleExpandResources}
      />}
      {workspaceShown ? <DocumentWorkspaceComponent isExpanderShown={showExpanders} />
                      : <CollapsedWorkspaceTab
                          onExpandWorkspace={toggleExpandWorkspace}
                          workspaceType={problemWorkspace.type}
                        />
      }
    </div>
  );
});
