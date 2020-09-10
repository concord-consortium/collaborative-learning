import React from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { getSectionTitle, SectionModelType } from "../../models/curriculum/section";
import { LeftNavPanelComponent } from "./left-nav-panel";

import "./problem-tab-content.sass";

interface IProps {
  sections: SectionModelType[];
}

export const ProblemTabContent: React.FC<IProps> = (props) => {
  const { sections } = props;
  return (
    <Tabs className="problem-tabs" selectedTabClassName="selected">
      <TabList className="tab-list">
        {sections.map((section) => {
          return (
            <Tab className="prob-tab" key={`section-${section.type}`}>
              {getSectionTitle(section.type)}
            </Tab>
          );
        })}
      </TabList>
      {sections.map((section) => {
        return (
          <TabPanel key={`section-${section.type}`}>
            <LeftNavPanelComponent section={section} key={`section-${section.type}`} />
          </TabPanel>
        );
      })}
    </Tabs>
  );
};
