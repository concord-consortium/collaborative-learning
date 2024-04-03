import { observer } from "mobx-react";
import React, { useCallback, useEffect, useRef } from "react";
import { IBaseProps } from "../base";
import { useStores } from "../../hooks/use-stores";
import { DocumentWorkspaceComponent } from "../document/document-workspace";
import { ImageDragDrop } from "../utilities/image-drag-drop";
import { NavTabPanel } from "../navigation/nav-tab-panel";
import { ResizePanelDivider } from "./resize-panel-divider";
import { ResizablePanel } from "./resizable-panel";
import { HotKeys } from "../../utilities/hot-keys";

import "./workspace.sass";

interface IProps extends IBaseProps {
}

export const WorkspaceComponent: React.FC<IProps> = observer((props) => {
  const stores = useStores();
  const { appConfig: { navTabs: navTabSpecs },
          persistentUI: { navTabContentShown, workspaceShown },
          documents
        } = stores;
  const hotKeys = useRef(new HotKeys());

  let imageDragDrop: ImageDragDrop;

  // For testing purposes, have cmd-shift-e reset all exemplars to their default state
  const resetAllExemplars = useCallback(() => {
    documents.resetAllExemplars();
  }, [documents]);

  useEffect(() => {
    hotKeys.current.register({
      "cmd-shift-e": resetAllExemplars
    });

  }, [resetAllExemplars]);

  const handleDragOverWorkspace = (e: React.DragEvent<HTMLDivElement>) => {
    imageDragDrop?.dragOver(e);
  };

  return (
    <div
      className="workspace"
      onKeyDown={(e) => hotKeys.current.dispatch(e)}>
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
