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
  onSelect?: (tabIdx: number) => void,
  // This will make the tabs a controlled component
  selectedIndex?: number,
}

export const SubTabsPanel: React.FC<IProps> = observer(function SubTabsPanel(
    { tabSpec, renderSubTabPanel, tabsExtraClassNames, onSelect, selectedIndex }) {

  // console.log("📁 sub-tabs-panel.tsx ------------------------");
  // console.log("\ttabSpec label:", tabSpec.label) ;
  // console.log("\ttabSpec:", (tabSpec as any).toJSON()) ;
  const appConfigStore = useAppConfig();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);

  // console.log("\t🥩 navTabSpec:", navTabSpec);
  const subTabs = tabSpec.subTabs;
  const hasSubTabs = subTabs.length > 1;
  // console.log("\t🥩 subTabs:", subTabs);
  const navTabClass = navTabSpec?.tab;

  // console.log("\t🥩 navTabClass:", navTabClass);
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
              // console.log("------subTabs Map-------");
              const sectionTitle = subTab.label.toLowerCase().replace(' ', '-');
              // console.log("\t🥩 sectionTitle:", sectionTitle);
              const type = subTab.sections[0].type;
              // console.log("\t🥩 type:", type);

              return (
                <Tab className={classNames("doc-tab", navTabClass, sectionTitle, type)}
                  key={`section-${sectionTitle}`}>
                  {subTab.label}
                </Tab>
              );
            })}
          </TabList>
        </div>
        <div className={classNames("documents-panel", {"no-sub-tabs": !hasSubTabs})}>
          {console.log("subtabs Before Map:", subTabs)}
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
