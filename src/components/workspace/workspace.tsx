import { observer } from "mobx-react";
import React, { CSSProperties, useCallback, useEffect, useRef } from "react";
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
          exemplarController,
          user: { isResearcher },
          ui: { standalone }
        } = stores;
  const hotKeys = useRef(new HotKeys());

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

  // RESEARCHER-ACCESS: this is a temporary solution to show only the the nav panel for researchers
  // until we decide where to store researcher docs that are automatically created in the
  // DocumentWorkspaceComponent component.
  const showLeftPanel = isResearcher || navTabSpecs.showNavPanel;
  const showRightPanel = !isResearcher;

  // this will be removed in a follow on story
  const renderStandalonePlaceholder = () => {
    const style: CSSProperties = {
      display: "flex",
      height: "100%",
      alignContent: "flex-start",
      justifyContent: "center",
      alignItems: "center"
    };
    return (
      <div style={style} data-test="standalone-placeholder">
        <div>
          TBD: Standalone
        </div>
      </div>
    );
  };

  return (
    <div
      className="workspace"
      onKeyDown={(e) => hotKeys.current.dispatch(e)}>
      <div
        className="drag-handler"
        onDragOver={handleDragOverWorkspace}
      />

      {showLeftPanel &&
        <>
          <ResizablePanel collapsed={!navTabContentShown} >
            <NavTabPanel
              onDragOver={handleDragOverWorkspace}
            />
          </ResizablePanel>
          {showRightPanel && <ResizePanelDivider />}
        </>
      }
      {showRightPanel &&
        <ResizablePanel collapsed={!workspaceShown}>
          {standalone ? renderStandalonePlaceholder() : <DocumentWorkspaceComponent />}
        </ResizablePanel>
      }
    </div>
  );
});
