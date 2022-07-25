import { observer } from "mobx-react";
import React from "react";
import { IBaseProps } from "../base";
import { kDividerHalf, kDividerMax, kDividerMin } from "../../models/stores/ui-types";
import { ImageDragDrop } from "../utilities/image-drag-drop";
import { NavTabPanel } from "../navigation/nav-tab-panel";
import { CollapsedResourcesTab } from "../navigation/collapsed-resources-tab";
import { CollapsedWorkspaceTab } from "../document/collapsed-document-workspace-tab";
import { ResizePanelDivider } from "./resize-panel-divider";

import "./workspace.sass";
import { useStores } from "../../hooks/use-stores";
import { DocumentWorkspaceComponent } from "../document/document-workspace";

interface IProps extends IBaseProps {
}

export const WorkspaceComponent: React.FC<IProps> = observer((props) => {
      const { appConfig: { navTabs: navTabSpecs },
            teacherGuide,
            user: { isTeacher },
            ui: { activeNavTab, navTabContentShown, dividerPosition,
                  workspaceShown, problemWorkspace, setDividerPosition }
          } = useStores();
  let imageDragDrop: ImageDragDrop;

  const handleDragOverWorkspace = (e: React.DragEvent<HTMLDivElement>) => {
    imageDragDrop.dragOver(e);
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
      <ResizePanelDivider
        isResourceExpanded={navTabContentShown}
        dividerPosition={dividerPosition}
        onExpandWorkspace={toggleExpandWorkspace}
        onExpandResources={toggleExpandResources}
      />
      {workspaceShown ? <DocumentWorkspaceComponent />
                      : <CollapsedWorkspaceTab
                          onExpandWorkspace={toggleExpandWorkspace}
                          workspaceType={problemWorkspace.type}
                        />
      }
    </div>
  );
});
