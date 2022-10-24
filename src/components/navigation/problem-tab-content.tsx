import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { useProblemPathWithFacet, useUIStore, useUserStore } from "../../hooks/use-stores";
import { getSectionTitle, SectionModelType } from "../../models/curriculum/section";
import { ProblemPanelComponent } from "./problem-panel";
import { Logger, LogEventName } from "../../lib/logger";
import ToggleControl from "../utilities/toggle-control";
import { ENavTab } from "../../models/view/nav-tabs";

import "./problem-tab-content.sass";

interface IProps {
  context?: string;   // ENavTab.kTeacherGuide for teacher guide, blank otherwise
  sections: SectionModelType[];
  showSolutionsSwitch: boolean;
  focusDocument?: string;
}

const kHeaderHeight = 55;
const kWorkspaceContentMargin = 4;
const kNavTabHeight = 34;
const kTabSectionBorderWidth = 2;

export const ProblemTabContent: React.FC<IProps>
  = observer(({ context, sections, showSolutionsSwitch, focusDocument}: IProps) => {
  const { isTeacher } = useUserStore();
  const ui = useUIStore();
  const problemPath = useProblemPathWithFacet(context);
  const { showTeacherContent } = ui;
  const hasSubTabs = sections && sections.length > 1;
  const chatBorder = ui.showChatPanel ? "chat-open" : "";
  const vh = window.innerHeight;
  const headerOffset = hasSubTabs
                        ? kHeaderHeight + (2 * (kWorkspaceContentMargin + kNavTabHeight + kTabSectionBorderWidth))
                        : kHeaderHeight + kNavTabHeight + (2 * (kWorkspaceContentMargin + kTabSectionBorderWidth));
  const problemsPanelHeight = vh - headerOffset;
  const problemsPanelStyle = { height: problemsPanelHeight };
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (ui.activeNavTab === ENavTab.kProblems) {
      ui.updateFocusDocument();
    }
    setActiveIndex((prevState) => {
      const newIndex = findSelectedSectionIndex(focusDocument);
      if (newIndex !== -1){
        return newIndex;
      } else {
        return prevState;
      }
    });
  }, [ui, focusDocument]);

  const handleTabClick = (titleArgButReallyType: string, typeArgButReallyTitle: string) => {
    // TODO: this function has its argument names reversed (see caller for details.)
    // We can't simply switch it, however, because that would introduce a breaking change
    // in the log event stream, so for now we just rename the arguments for clarity.
    Logger.log(LogEventName.SHOW_TAB_SECTION, {
      tab_section_name: titleArgButReallyType,
      tab_section_type: typeArgButReallyTitle
    });
    ui.setSelectedTile();
    ui.updateFocusDocument();
    findSelectedSectionIndex(focusDocument);
  };

  const findSelectedSectionIndex = (fullPath: string | undefined) => {
    if (fullPath !==undefined){
      const lastSlashPosition = fullPath.split("/", 3).join("_").length + 1;
      const sectionSelected =  fullPath.substring(lastSlashPosition, fullPath.length);
      const index =  sections.findIndex((section: any) => section.type === sectionSelected);
      return index;
    }
    else {
      return 0;
    }
  };

  const handleToggleSolutions = () => {
    ui.toggleShowTeacherContent(!showTeacherContent);
    Logger.log(showTeacherContent ? LogEventName.HIDE_SOLUTIONS : LogEventName.SHOW_SOLUTIONS);
  };

  return (
    <Tabs className={classNames("problem-tabs", context, chatBorder)}
          selectedTabClassName="selected"
          selectedIndex={activeIndex || 0}
          data-focus-document={problemPath}
    >
      <div className={classNames("tab-header-row", {"no-sub-tabs": !hasSubTabs})}>
        <TabList className={classNames("tab-list", {"chat-open" : ui.showChatPanel})}>
          {sections?.map((section, index) => {
            const sectionTitle = getSectionTitle(section.type);
            return (
              <Tab
                className={classNames("prob-tab", context)}
                key={`section-${section.type}`}
                onClick={() => {
                  handleTabClick(section.type, sectionTitle);
                  setActiveIndex(index);
                }}
              >
                {sectionTitle}
              </Tab>
            );
          })}
        </TabList>
        {isTeacher && showSolutionsSwitch &&
          <SolutionsButton onClick={handleToggleSolutions} isToggled={showTeacherContent} />}
      </div>
      <div className="problem-panel" style={problemsPanelStyle}>
        {sections?.map((section) => {
          return (
            <TabPanel key={`section-${section.type}`} data-focus-section={section.type}>
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
                      initialValue={isToggled} onChange={onClick}
                      title={isToggled
                                  ? "Showing solutions: click to hide"
                                  : "Hiding solutions: click to show"} />
      <div className="solutions-label">Solutions</div>
    </div>
  );
};
