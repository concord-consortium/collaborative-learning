import React from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { getSectionInitials, SectionModelType } from "../../models/curriculum/section";
import { LeftNavPanelComponent } from "./left-nav-panel";

import "./problem-tab-content.sass";

interface IProps {
  isGhostUser: boolean;
  sections: SectionModelType[];
}

export const ProblemTabContent: React.FC<IProps> = (props) => {
  const { isGhostUser, sections } = props;
  return (
    <Tabs className="problem-tabs" selectedTabClassName="selected">
      <TabList className="tab-list">
        {sections.map((section) => {
          return (
            <Tab className="prob-tab" key={`section-${section.type}`}>
              {getSectionInitials(section.type)}
            </Tab>
          );
        })}
      </TabList>
      {sections.map((section) => {
        return (
          <TabPanel key={`section-${section.type}`}>
            <LeftNavPanelComponent
              section={section}
              isGhostUser={isGhostUser}
              key={`section-${section.type}`}
            />
          </TabPanel>
        );
      })}
    </Tabs>
  );
};
