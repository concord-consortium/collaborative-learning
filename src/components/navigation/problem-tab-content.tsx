import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect } from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { useProblemPathWithFacet, usePersistentUIStore, useUserStore, useUIStore } from "../../hooks/use-stores";
import { getSectionTitle, SectionModelType } from "../../models/curriculum/section";
import { ProblemPanelComponent } from "./problem-panel";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import ToggleControl from "../utilities/toggle-control";
import { ENavTab } from "../../models/view/nav-tabs";

import "./problem-tab-content.sass";

interface IProps {
  context?: string;   // ENavTab.kTeacherGuide for teacher guide, blank otherwise
  sections: SectionModelType[];
  showSolutionsSwitch: boolean;
}

export const ProblemTabContent: React.FC<IProps>
  = observer(function ProblemTabContent({ context, sections, showSolutionsSwitch }: IProps) {
  const { isTeacher } = useUserStore();
  const persistentUI = usePersistentUIStore();
  const ui = useUIStore();
  const { showTeacherContent } = persistentUI;
  const problemPath = useProblemPathWithFacet(context);
  const hasSubTabs = sections && sections.length > 1;
  const chatBorder = persistentUI.showChatPanel ? "chat-open" : "";
  const tabId = context || ENavTab.kProblems;

  useEffect(() => {
    // Set the default subTab if a subtab isn't already set
    if (hasSubTabs && !persistentUI.tabs.get(tabId)?.openSubTab) {
      persistentUI.setOpenSubTab(tabId, sections[0].type);
    }
  }, [hasSubTabs, sections, tabId, persistentUI]);

  const handleTabSelected = (index: number) => {
    const section = sections?.[index];
    if (!section) return;

    persistentUI.setOpenSubTab(tabId, section.type);

    // TODO: The log event properties have been reversed for quite a while now.
    // We don't want to introduce a breaking change in the log event stream, so
    // the variables are named for clarity. It might be better to add a version
    // property to the log event so we can fix this.
    const namePropButReallyType = section.type;
    const typePropButReallyTitle = getSectionTitle(section.type);
    Logger.log(LogEventName.SHOW_TAB_SECTION, {
      tab_section_name: namePropButReallyType,
      tab_section_type: typePropButReallyTitle
    });
    // Clear any selected tiles when the tab changes
    ui.setSelectedTile();
  };

  const handleToggleSolutions = () => {
    persistentUI.toggleShowTeacherContent(!showTeacherContent);
    Logger.log(showTeacherContent ? LogEventName.HIDE_SOLUTIONS : LogEventName.SHOW_SOLUTIONS);
  };

  const openSubTab = persistentUI.tabs.get(tabId)?.openSubTab;
  const sectionIndex = sections.findIndex((section: any) => section.type === openSubTab);
  // activeIndex might be -1 in an error condition
  const activeIndex = sectionIndex < 0 ? 0 : sectionIndex;

  return (
    <Tabs className={classNames("problem-tabs", context, chatBorder)}
          selectedTabClassName="selected"
          selectedIndex={activeIndex || 0}
          onSelect={handleTabSelected}
          data-focus-document={problemPath}
    >
      <div className={classNames("tab-header-row", {"no-sub-tabs": !hasSubTabs})}>
        <TabList className={classNames("tab-list", {"chat-open" : persistentUI.showChatPanel})}>
          {sections?.map((section, index) => {

            console.log("📁 problem-tab-content.tsx ------------------------");
            console.log("\t🥩 section:", section);
            const sectionTitle = getSectionTitle(section.type);
            return (
              <Tab
                className={classNames("prob-tab", context)}
                key={`section-${section.type}`}
              >
                {sectionTitle}
              </Tab>
            );
          })}
        </TabList>
        {isTeacher && showSolutionsSwitch &&
          <SolutionsButton onClick={handleToggleSolutions} isToggled={showTeacherContent} />}
      </div>
      <div className="problem-panels-container">
        {sections?.map((section) => {
          return (
            <TabPanel key={`section-${section.type}`} data-focus-section={section.type}
                className={["react-tabs__tab-panel", "problem-panel-tab-panel"]}>
              <ProblemPanelComponent section={section} key={`section-${section.type}`} />
            </TabPanel>
          );
        })}
      </div>
    </Tabs>
  );
});

const SolutionsButton = ({ onClick, isToggled }: { onClick: () => void, isToggled: boolean }) => {
  const classes = classNames("solutions-button", { toggled: isToggled });
  return (
    <div className="solutions-switch">
      <ToggleControl className={classes} dataTest="solutions-button"
                      value={isToggled} onChange={onClick}
                      title={isToggled
                                  ? "Showing solutions: click to hide"
                                  : "Hiding solutions: click to show"} />
      <div className="solutions-label">Solutions</div>
    </div>
  );
};
