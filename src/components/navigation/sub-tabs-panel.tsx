import React from "react";
import { observer } from "mobx-react";
import { Tab, TabList, TabPanel, Tabs } from "react-tabs";
import classNames from "classnames";
import { useAppConfig } from "../../hooks/use-stores";
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
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  const subTabs = tabSpec.subTabs;
  const hasSubTabs = subTabs.length > 1;
  const navTabClass = navTabSpec?.tab;

  return (
    <div className="document-tab-content">
      <Tabs
        className={classNames("document-tabs", navTabClass, tabsExtraClassNames, {"no-sub-tabs": !hasSubTabs})}
        forceRenderTabPanel={true}
        selectedTabClassName="selected"
        onSelect={onSelect}
        selectedIndex={selectedIndex}
      >
        <TabList className={classNames("tab-list", navTabClass)}>
          {subTabs.map((subTab) => {
            const sectionTitle = subTab.label.toLowerCase().replaceAll(' ', '-');
            const type = subTab.sections?.[0]?.type;
            return (
              <Tab className={classNames("doc-tab", navTabClass, sectionTitle, type)}
                key={`section-${sectionTitle}`}>
                {subTab.label}
              </Tab>
            );
          })}
        </TabList>
        {subTabs.map((subTab) => {
          const sectionTitle = subTab.label.toLowerCase().replaceAll(' ', '-');
          return (
            <TabPanel key={`subtab-${subTab.label}`} className={classNames("react-tabs__tab-panel", "sub-tab-panel")}
              data-test={`subtab-${sectionTitle}`}>
              { renderSubTabPanel(subTab) }
            </TabPanel>
          );
        })}
      </Tabs>
    </div>
  );
});
