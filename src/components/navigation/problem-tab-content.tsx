import React from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { getSectionTitle, SectionModelType } from "../../models/curriculum/section";
import { ProblemPanelComponent } from "./problem-panel";
import { Logger, LogEventName } from "../../lib/logger";

import "./problem-tab-content.sass";

interface IProps {
  sections: SectionModelType[];
}

export const ProblemTabContent: React.FC<IProps> = (props) => {
  const { sections } = props;

  const handleTabClick = (title: string, type: string) => {
    Logger.log(LogEventName.SHOW_TAB_SECTION, {
      tab_section_name: title,
      tab_section_type: type
    });
  };

  return (
    <Tabs className="problem-tabs" selectedTabClassName="selected">
      <TabList className="tab-list">
        {sections.map((section) => {
          const sectionTitle = getSectionTitle(section.type);
          return (
            <Tab className="prob-tab" key={`section-${section.type}`}
                 onClick={() => handleTabClick(section.type, sectionTitle)}
            >
              {sectionTitle}
            </Tab>
          );
        })}
      </TabList>
      {sections.map((section) => {
        return (
          <TabPanel key={`section-${section.type}`}>
            <ProblemPanelComponent section={section} key={`section-${section.type}`} />
          </TabPanel>
        );
      })}
    </Tabs>
  );
};
