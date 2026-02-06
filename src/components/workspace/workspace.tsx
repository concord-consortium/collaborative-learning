import { observer } from "mobx-react";
import React, { useCallback, useEffect, useRef } from "react";
import { IBaseProps } from "../base";
import { useStores } from "../../hooks/use-stores";
import { useAriaLabels } from "../../hooks/use-aria-labels";
import { DocumentWorkspaceComponent } from "../document/document-workspace";
import { ImageDragDrop } from "../utilities/image-drag-drop";
import { NavTabPanel } from "../navigation/nav-tab-panel";
import { ResizePanelDivider } from "./resize-panel-divider";
import { ResizablePanel } from "./resizable-panel";
import { HotKeys } from "../../utilities/hot-keys";
import { StandAloneAuthComponent } from "../standalone/auth";

import "./workspace.scss";

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
  const ariaLabels = useAriaLabels();
  const mainWorkspaceRef = useRef<HTMLElement>(null);

  // Handle skip link click
  const handleSkipToMain = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    mainWorkspaceRef.current?.focus();
  }, []);

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
  const showLeftPanel =  stores.isProblemLoaded && (isResearcher || navTabSpecs.showNavPanel);
  const showRightPanel = !isResearcher;

  return (
    <div
      className="workspace"
      onKeyDown={(e) => hotKeys.current.dispatch(e)}>
      {/* Skip navigation link - first focusable element */}
      <a
        href="#main-workspace"
        className="skip-link"
        onClick={handleSkipToMain}
        onKeyDown={(e) => e.key === 'Enter' && handleSkipToMain(e)}
      >
        {ariaLabels.skipToMain}
      </a>

      {/* Screen reader announcements live region */}
      <div
        id="clue-announcements"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
        aria-label={ariaLabels.announcements}
      />

      <div
        className="drag-handler"
        onDragOver={handleDragOverWorkspace}
      />

      {showLeftPanel &&
        <>
          <ResizablePanel collapsed={!navTabContentShown} >
            <nav role="navigation" aria-label={ariaLabels.resourcesPane}>
              <NavTabPanel
                onDragOver={handleDragOverWorkspace}
              />
            </nav>
          </ResizablePanel>
          {showRightPanel && <ResizePanelDivider />}
        </>
      }
      {showRightPanel &&
        <ResizablePanel collapsed={!workspaceShown}>
          <main
            role="main"
            id="main-workspace"
            aria-label={ariaLabels.workspacePane}
            tabIndex={-1}
            ref={mainWorkspaceRef}
          >
            {standalone ? <StandAloneAuthComponent /> : <DocumentWorkspaceComponent />}
          </main>
        </ResizablePanel>
      }
    </div>
  );
});
