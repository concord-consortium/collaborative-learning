import classNames from "classnames";
import { observer } from "mobx-react";
import React from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { useUIStore, useUserStore } from "../../hooks/use-stores";
import { getSectionTitle, SectionModelType } from "../../models/curriculum/section";
import { ProblemPanelComponent } from "./problem-panel";
import { Logger, LogEventName } from "../../lib/logger";
import ToggleControl from "../utilities/toggle-control";

import "./problem-tab-content.sass";

interface IProps {
  sections: SectionModelType[];
}

export const ProblemTabContent: React.FC<IProps> = observer((props) => {
  const { sections } = props;
  const { isTeacher } = useUserStore();
  const { showTeacherContent, toggleShowTeacherContent } = useUIStore();

  const handleTabClick = (title: string, type: string) => {
    Logger.log(LogEventName.SHOW_TAB_SECTION, {
      tab_section_name: title,
      tab_section_type: type
    });
  };

  const handleToggleSolutions = () => {
    toggleShowTeacherContent(!showTeacherContent);
  };

  return (
    <Tabs className="problem-tabs" selectedTabClassName="selected">
      <div className="tab-header-row">
        <TabList className="tab-list">
          {sections.map((section) => {
            const sectionTitle = getSectionTitle(section.type);
            return (
              <Tab className="prob-tab" key={`section-${section.type}`}
                  onClick={() => handleTabClick(section.type, sectionTitle)} >
                {sectionTitle}
              </Tab>
            );
          })}
        </TabList>
        {isTeacher &&
          <SolutionsButton onClick={handleToggleSolutions} isToggled={showTeacherContent} />}
      </div>
      {sections.map((section) => {
        return (
          <TabPanel key={`section-${section.type}`}>
            <ProblemPanelComponent section={section} key={`section-${section.type}`} />
          </TabPanel>
        );
      })}
    </Tabs>
  );
});

const SolutionsButton = ({ onClick, isToggled }: { onClick: () => void, isToggled: boolean }) => {
  const classes = classNames("solutions-button", { toggled: isToggled });
  return (
    <div className="solutions-switch">
      {<div className="solutions-separator" />}
      <ToggleControl className={classes} dataTest="solutions-button"
                      initialValue={isToggled} onChange={onClick}
                      title={isToggled
                                  ? "Showing solutions: click to hide"
                                  : "Hiding solutions: click to show"} />
      <div className="solutions-label">Solutions</div>
    </div>
  );
};
