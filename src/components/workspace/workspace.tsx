import { observer } from "mobx-react";
import React, { useCallback, useEffect, useRef } from "react";
import { IBaseProps } from "../base";
import { useStores } from "../../hooks/use-stores";
import { usePanelVisibility } from "../../hooks/use-panel-visibility";
import { DocumentWorkspaceComponent } from "../document/document-workspace";
import { ImageDragDrop } from "../utilities/image-drag-drop";
import { NavTabPanel } from "../navigation/nav-tab-panel";
import { ResizePanelDivider } from "./resize-panel-divider";
import { ResizablePanel } from "./resizable-panel";
import { HotKeys } from "../../utilities/hot-keys";
import { StandAloneAuthComponent } from "../standalone/auth";
import { getAriaLabels } from "../../hooks/use-aria-labels";

import "./workspace.scss";

interface IProps extends IBaseProps {
}

export const WorkspaceComponent: React.FC<IProps> = observer((props) => {
  const stores = useStores();
  const { persistentUI: { navTabContentShown, workspaceShown },
          exemplarController,
          problem,
          ui: { standalone }
        } = stores;
  const hotKeys = useRef(new HotKeys());
  const { showLeftPanel, showRightPanel } = usePanelVisibility();
  const ariaLabels = getAriaLabels();
  const problemTitle = stores.isProblemLoaded
    ? problem.title + (problem.subtitle ? `: ${problem.subtitle}` : "")
    : undefined;

  let imageDragDrop: ImageDragDrop;

  // For testing purposes, have cmd-shift-e reset all exemplars to their default state
  const resetAllExemplars = useCallback(() => {
    exemplarController.resetAllExemplars();
  }, [exemplarController]);

  useEffect(() => {
    hotKeys.current.register({
      "cmd-shift-e": resetAllExemplars
    });

  }, [resetAllExemplars]);

  const handleDragOverWorkspace = (e: React.DragEvent<HTMLDivElement>) => {
    imageDragDrop?.dragOver(e);
  };

  return (
    <main
      className="workspace"
      onKeyDown={(e) => hotKeys.current.dispatch(e)}>
      {problemTitle && <h1 className="visually-hidden">{problemTitle}</h1>}
      <div
        className="drag-handler"
        onDragOver={handleDragOverWorkspace}
      />

      {showLeftPanel &&
        <>
          <ResizablePanel
            collapsed={!navTabContentShown}
            id="resources-panel"
            headingLabel={ariaLabels.resourcesPane}
            tabIndex={-1}
          >
            <NavTabPanel
              onDragOver={handleDragOverWorkspace}
            />
          </ResizablePanel>
          {showRightPanel && <ResizePanelDivider />}
        </>
      }
      {showRightPanel &&
        <ResizablePanel
          collapsed={!workspaceShown}
          id="workspace-panel"
          headingLabel={ariaLabels.workspacePane}
          tabIndex={-1}
        >
          {standalone ? <StandAloneAuthComponent /> : <DocumentWorkspaceComponent />}
        </ResizablePanel>
      }
    </main>
  );
});
