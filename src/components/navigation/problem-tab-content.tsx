import classNames from "classnames";
import { observer } from "mobx-react";
import React from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { useProblemPathWithFacet, useUIStore, useUserStore } from "../../hooks/use-stores";
import { getSectionTitle, SectionModelType } from "../../models/curriculum/section";
import { ProblemPanelComponent } from "./problem-panel";
import { Logger, LogEventName } from "../../lib/logger";
import ToggleControl from "../utilities/toggle-control";

import "./problem-tab-content.sass";

interface IProps {
  context?: string;   // ENavTab.kTeacherGuide for teacher guide, blank otherwise
  sections: SectionModelType[];
  showSolutionsSwitch: boolean;
  isChatOpen?: boolean
}

export const ProblemTabContent: React.FC<IProps>
  = observer(({ context, sections, showSolutionsSwitch, isChatOpen}: IProps) => {
  const { isTeacher } = useUserStore();
  const ui = useUIStore();
  const problemPath = useProblemPathWithFacet(context);
  const { showTeacherContent } = ui;
  const chatBorder = isChatOpen ? "chat-open" : "";

  const handleTabClick = (titleArgButReallyType: string, typeArgButReallyTitle: string) => {
    // TODO: this function has its argument names reversed (see caller for details.)
    // We can't simply switch it, however, because that would introduce a breaking change
    // in the log event stream, so for now we just rename the arguments for clarity.
    Logger.log(LogEventName.SHOW_TAB_SECTION, {
      tab_section_name: titleArgButReallyType,
      tab_section_type: typeArgButReallyTitle
    });

    ui.updateFocusDocument();
};

  const handleToggleSolutions = () => {
    ui.toggleShowTeacherContent(!showTeacherContent);
    Logger.log(showTeacherContent ? LogEventName.HIDE_SOLUTIONS : LogEventName.SHOW_SOLUTIONS);
  };

  return (
    <Tabs className={classNames("problem-tabs", context, chatBorder)} selectedTabClassName="selected"
          data-focus-document={problemPath}>
      <div className="tab-header-row">
        <TabList className={classNames("tab-list", {"chat-open" : isChatOpen})}>
          {sections.map((section) => {
            const sectionTitle = getSectionTitle(section.type);
            return (
              <Tab className={classNames("prob-tab", context)} key={`section-${section.type}`}
                  onClick={() => handleTabClick(section.type, sectionTitle)} >
                {sectionTitle}
              </Tab>
            );
          })}
        </TabList>
        {isTeacher && showSolutionsSwitch &&
          <SolutionsButton onClick={handleToggleSolutions} isToggled={showTeacherContent} />}
      </div>
      {sections.map((section) => {
        return (
          <TabPanel key={`section-${section.type}`} data-focus-section={section.type}>
            <ProblemPanelComponent section={section} key={`section-${section.type}`} isChatOpen={isChatOpen}/>
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
      <ToggleControl className={classes} dataTest="solutions-button"
                      initialValue={isToggled} onChange={onClick}
                      title={isToggled
                                  ? "Showing solutions: click to hide"
                                  : "Hiding solutions: click to show"} />
      <div className="solutions-label">Solutions</div>
    </div>
  );
};
