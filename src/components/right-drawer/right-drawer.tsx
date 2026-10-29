import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useStores } from "../../hooks/use-stores";

import "./right-drawer.scss";

export const kRightDrawerPanelTabId = "right-drawer-panel-tab";

interface IProps {
  // True when the student has Ada, so the drawer can offer her next to a panel.
  chatTutorAvailable: boolean;
  // Renders Ada's drawer content. `active` is false while the panel tab is selected: Ada stays
  // mounted then so her conversation is kept.
  renderChatTutor?: (active: boolean) => React.ReactNode;
}

// The fixed right-edge slot shared by Ada's chat and plugin-supplied panels (see
// ui.openDrawerPanel). The workspace makes room for it (see clue-app-content.scss), so nothing is
// covered. It renders nothing while neither is open.
export const RightDrawer: React.FC<IProps> = observer(function RightDrawer(props) {
  const { chatTutorAvailable, renderChatTutor } = props;
  const { ui } = useStores();
  const { drawerPanel, drawerTab } = ui;

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
      {/* Two toggle buttons rather than ARIA tabs: the pressed one is showing. */}
      {showTabs && drawerPanel &&
        <div className="right-drawer-tabs">
          <button type="button" aria-pressed={adaActive}
                  className={classNames("right-drawer-tab", { selected: adaActive })}
                  onClick={selectAda}>
            Ada
          </button>
          <button type="button" id={kRightDrawerPanelTabId} aria-pressed={panelShowing}
                  className={classNames("right-drawer-tab", { selected: panelShowing })}
                  onClick={() => ui.setDrawerTab("panel")}>
            {drawerPanel.tabLabel}
          </button>
        </div>
      }
      {adaShowing &&
        <div className="right-drawer-body" hidden={!adaActive}>
          {renderChatTutor?.(adaActive)}
        </div>
      }
      {drawerPanel && panelShowing &&
        <div className="right-drawer-body">
          <drawerPanel.Component onClose={() => ui.closeDrawerPanel()} />
        </div>
      }
    </div>
  );
});
