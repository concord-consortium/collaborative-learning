import { observer } from "mobx-react";
import React from "react";
import { IBaseProps } from "../base";
import { useStores } from "../../hooks/use-stores";
import { DocumentWorkspaceComponent } from "../document/document-workspace";
import { ImageDragDrop } from "../utilities/image-drag-drop";
import { NavTabPanel } from "../navigation/nav-tab-panel";
import { ResizePanelDivider } from "./resize-panel-divider";
import { ResizablePanel } from "./resizable-panel";

import "./workspace.sass";

interface IProps extends IBaseProps {
}

export const WorkspaceComponent: React.FC<IProps> = observer((props) => {
  const stores = useStores();
  const { appConfig: { navTabs: navTabSpecs },
          ui: { navTabContentShown, workspaceShown }
        } = stores;

  let imageDragDrop: ImageDragDrop;

  const handleDragOverWorkspace = (e: React.DragEvent<HTMLDivElement>) => {
    imageDragDrop?.dragOver(e);
  };

  return (
    <div className="workspace">
      <div
        className="drag-handler"
        onDragOver={handleDragOverWorkspace}
      />

      {navTabSpecs.showNavPanel &&
        <>
          <ResizablePanel collapsed={!navTabContentShown} >
            <NavTabPanel
              onDragOver={handleDragOverWorkspace}
            />
          </ResizablePanel>
          <ResizePanelDivider />
        </>
      }
      <ResizablePanel collapsed={!workspaceShown}>
        <DocumentWorkspaceComponent />
      </ResizablePanel>
    </div>
  );
});
