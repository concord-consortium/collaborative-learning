import React, { useRef } from "react";
import { observer } from "mobx-react";
import { Tab, TabList, TabPanel, Tabs } from "react-tabs";
import classNames from "classnames";
import { useAppConfig, useStores } from "../../hooks/use-stores";
import { ISubTabModel, NavTabModelType } from "../../models/view/nav-tabs";

import "./sub-tabs-panel.scss";

interface IProps {
  tabSpec: NavTabModelType;
  renderSubTabPanel: (subTab: ISubTabModel) => JSX.Element;
  tabsExtraClassNames?: classNames.Argument,
  onSelect?: (tabIdx: number) => void,
  // This will make the tabs a controlled component
  selectedIndex?: number,
}

export const SubTabsPanel: React.FC<IProps> = observer(function SubTabsPanel(
    { tabSpec, renderSubTabPanel, tabsExtraClassNames, onSelect, selectedIndex }) {
  const appConfigStore = useAppConfig();
  const { ui } = useStores();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  const subTabs = tabSpec.subTabs;
  const hasSubTabs = subTabs.length > 1;
  const navTabClass = navTabSpec?.tab;
  const documentsPanelRef = useRef<HTMLDivElement>(null);

  // Handle Up/Down arrow navigation from subtab
  const handleSubTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation(); // Prevent react-tabs from treating ArrowUp as "previous tab"
      // Find the currently selected top-level tab and focus it
      const topTabList = document.querySelector('.top-tab-list [aria-selected="true"]') as HTMLElement;
      if (topTabList) {
        topTabList.focus();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation(); // Prevent react-tabs from treating ArrowDown as "next tab"
      // Find the first tile gridcell in the active tab panel and select it
      const activePanel = documentsPanelRef.current?.querySelector(
        '.react-tabs__tab-panel--selected'
      ) as HTMLElement;
      if (activePanel) {
        const firstGridcell = activePanel.querySelector('[role="gridcell"]') as HTMLElement;
        if (firstGridcell) {
          const tileId = firstGridcell.getAttribute('data-tile-id');
          if (tileId) {
            // Select the tile via UI model - componentDidUpdate will focus it
            ui.setSelectedTileId(tileId);
            // Also focus directly as a fallback
            firstGridcell.focus();
          }
        }
      }
    }
  };

  // Handle ArrowUp from tiles at the top of the grid to return to subtab
  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      const target = e.target as HTMLElement;
      // Only handle if focus is on a gridcell (tile container, not inside content)
      if (target.getAttribute('role') === 'gridcell') {
        // Check if this is in the first row of the grid
        const grid = target.closest('[role="grid"]');
        if (grid) {
          const firstRow = grid.querySelector('[role="row"]');
          if (firstRow?.contains(target)) {
            e.preventDefault();
            e.stopPropagation();
            const selectedSubTab = documentsPanelRef.current
              ?.closest('.document-tab-content')
              ?.querySelector('.tab-list [aria-selected="true"]') as HTMLElement;
            if (selectedSubTab) {
              selectedSubTab.focus();
            }
          }
        }
      }
    }
  };

  return (
    <div className="document-tab-content">
      <Tabs
        className={classNames("document-tabs", navTabClass, tabsExtraClassNames)}
        forceRenderTabPanel={true}
        selectedTabClassName="selected"
        onSelect={onSelect}
        selectedIndex={selectedIndex}
      >
        <div className={classNames("tab-header-row", {"no-sub-tabs": !hasSubTabs})}>
          <TabList className={classNames("tab-list", navTabClass)} aria-label={`${tabSpec.label} sub-sections`}>
            {subTabs.map((subTab) => {
              const sectionTitle = subTab.label.toLowerCase().replace(' ', '-');
              const type = subTab.sections[0].type;
              return (
                <Tab
                  className={classNames("doc-tab", navTabClass, sectionTitle, type)}
                  key={`section-${sectionTitle}`}
                  onKeyDown={handleSubTabKeyDown}
                >
                  {subTab.label}
                </Tab>
              );
            })}
          </TabList>
        </div>
        <div
          ref={documentsPanelRef}
          className={classNames("documents-panel", {"no-sub-tabs": !hasSubTabs})}
          onKeyDown={handlePanelKeyDown}
        >
          {subTabs.map((subTab, index) => {
            const sectionTitle = subTab.label.toLowerCase().replace(' ', '-');
            return (
              <TabPanel key={`subtab-${subTab.label}`} className={["react-tabs__tab-panel", "sub-tab-panel"]}
                data-test={`subtab-${sectionTitle}`}>
                { renderSubTabPanel(subTab) }
              </TabPanel>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
});
