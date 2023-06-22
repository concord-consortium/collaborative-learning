import React from "react";
import { observer } from "mobx-react";
import { Tab, TabList, TabPanel, Tabs } from "react-tabs";
import classNames from "classnames";
import { useAppConfig } from "../../hooks/use-stores";
import { ISubTabSpec, NavTabModelType } from "../../models/view/nav-tabs";

import "./sub-tabs-panel.sass";

interface IProps {
  tabSpec: NavTabModelType;
  renderSubTabPanel: (subTab: ISubTabSpec) => JSX.Element;
  tabsExtraClassNames?: classNames.Argument,
  // These will make the tabs a controlled component
  onSelect?: (tabIdx: number) => void,
  selectedIndex?: number
}

const kHeaderHeight = 55;
const kWorkspaceContentMargin = 4;
const kNavTabHeight = 34;
const kTabSectionBorderWidth = 2;

export const SubTabsPanel: React.FC<IProps> = observer(function SubTabsPanel(
    { tabSpec, renderSubTabPanel, tabsExtraClassNames, onSelect, selectedIndex }) {
  const appConfigStore = useAppConfig();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  const subTabs = tabSpec.subTabs;
  const hasSubTabs = subTabs.length > 1;

  const vh = window.innerHeight;
  const headerOffset = hasSubTabs
                        ? kHeaderHeight + (2 * (kWorkspaceContentMargin + kNavTabHeight + kTabSectionBorderWidth))
                        : kHeaderHeight + kNavTabHeight + (2 * (kWorkspaceContentMargin + kTabSectionBorderWidth));
  const documentsPanelHeight = vh - headerOffset;
  const documentsPanelStyle = { height: documentsPanelHeight };

  const navTabClass = navTabSpec?.tab;

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
          <TabList className={classNames("tab-list", navTabClass)}>
            {subTabs.map((subTab) => {
              const sectionTitle = subTab.label.toLowerCase().replace(' ', '-');
              const type = subTab.sections[0].type;
              return (
                <Tab className={classNames("doc-tab", navTabClass, sectionTitle, type)}
                  key={`section-${sectionTitle}`}>
                  {subTab.label}
                </Tab>
              );
            })}
          </TabList>
        </div>
        <div className="documents-panel" style={documentsPanelStyle}>
          {subTabs.map((subTab, index) => {
            const sectionTitle = subTab.label.toLowerCase().replace(' ', '-');
            return (
              <TabPanel key={`subtab-${subTab.label}`} data-test={`subtab-${sectionTitle}`}>
                { renderSubTabPanel(subTab) }
              </TabPanel>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
});
