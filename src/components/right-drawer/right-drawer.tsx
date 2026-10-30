import React, { RefObject, useEffect, useRef } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useStores } from "../../hooks/use-stores";

import "./right-drawer.scss";

export const kRightDrawerPanelTabId = "right-drawer-panel-tab";

interface IProps {
  // True when the student has Ada, so the drawer can offer her next to a panel.
  chatTutorAvailable: boolean;
  // Renders Ada's sidebar. `active` is false while the panel tab is selected: Ada stays mounted
  // then, so her unsent message and scroll position are kept. `tabsRef` is the tab buttons' row, which Ada's
  // focus trap lets Tab reach.
  renderChatTutor?: (active: boolean, tabsRef: RefObject<HTMLDivElement>) => React.ReactNode;
}

// The fixed right-edge slot shared by Ada's chat and plugin-supplied panels (see
// ui.openDrawerPanel). Pages make room for it (see $right-drawer-reserved-width in vars.scss), so
// nothing is covered. It renders nothing while neither is open.
export const RightDrawer: React.FC<IProps> = observer(function RightDrawer(props) {
  const { chatTutorAvailable, renderChatTutor } = props;
  const { ui } = useStores();
  const { drawerPanel, drawerTab } = ui;
  const tabsRef = useRef<HTMLDivElement>(null);

  // Lets code that opens a panel tell whether this view can show one.
  useEffect(() => {
    ui.addRightDrawerHost();
    return () => ui.removeRightDrawerHost();
  }, [ui]);

  const adaShowing = chatTutorAvailable && ui.showChatTutor;
  // The panel shows when it is the selected tab, or when Ada isn't open to compete with it.
  const panelShowing = !!drawerPanel && (drawerTab === "panel" || !adaShowing);
  const adaActive = adaShowing && !panelShowing;
  if (!adaShowing && !drawerPanel) return null;

  const showTabs = chatTutorAvailable && !!drawerPanel;
  const selectAda = () => {
    ui.setShowChatTutor(true);
    ui.setDrawerTab("chatTutor");
  };

  return (
    <div className="right-drawer" data-testid="right-drawer">
      {/* Two buttons rather than ARIA tabs; aria-current marks the one showing. */}
      {showTabs && drawerPanel &&
        <div className="right-drawer-tabs" ref={tabsRef}>
          <button type="button" aria-current={adaActive || undefined}
                  className={classNames("right-drawer-tab", { selected: adaActive })}
                  onClick={selectAda}>
            Ada
          </button>
          <button type="button" id={kRightDrawerPanelTabId} aria-current={panelShowing || undefined}
                  className={classNames("right-drawer-tab", { selected: panelShowing })}
                  onClick={() => ui.setDrawerTab("panel")}>
            {drawerPanel.tabLabel}
          </button>
        </div>
      }
      {adaShowing &&
        <div className="right-drawer-body" hidden={!adaActive}>
          {renderChatTutor?.(adaActive, tabsRef)}
        </div>
      }
      {drawerPanel && panelShowing &&
        <div className="right-drawer-body">
          <drawerPanel.Component key={drawerPanel.id} onClose={() => ui.closeDrawerPanel()} />
        </div>
      }
    </div>
  );
});
