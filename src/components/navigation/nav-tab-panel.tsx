import { inject, observer } from "mobx-react";
import React from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { BaseComponent, IBaseProps } from "../base";
import { kDividerMax, kDividerMin } from "../../models/stores/ui-types";
import { NavTabSpec, ENavTab, NavTabModelType } from "../../models/view/nav-tabs";
import { getTabsToDisplay } from "../../models/stores/stores";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { StudentGroupView } from "../document/student-group-view";
import { ProblemTabContent } from "./problem-tab-content";
import { SectionDocumentOrBrowser } from "./section-document-or-browser";
// import { NewCommentsBadge } from "./new-comments-badge";
import { ChatPanel } from "../chat/chat-panel";
import ChatIcon from "../../assets/chat-icon.svg";

import "react-tabs/style/react-tabs.css";
import "./nav-tab-panel.sass";
import "../themes.scss";

interface IProps extends IBaseProps {
  isResourceExpanded: boolean;
  isExpanderShown: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
}


@inject("stores")
@observer
export class NavTabPanel extends BaseComponent<IProps> {

  private navTabPanelElt: HTMLDivElement | null = null;
  private tabs: NavTabModelType[];

  constructor(props: IProps) {
    super(props);
    this.tabs = getTabsToDisplay(this.stores);
  }

  public render() {
    const { isResourceExpanded, isExpanderShown } = this.props;
    const { ui: { activeNavTab, dividerPosition, focusDocument, showChatPanel, selectedTileIds },
            user } = this.stores;
    const { tabs } = this;
    const selectedTabIndex = tabs?.findIndex(t => t.tab === activeNavTab);
    const resizePanelWidth = 6;
    const collapseTabWidth = 44;
    const resourceWidth = dividerPosition === kDividerMin
                            ? kDividerMin
                            : dividerPosition === kDividerMax
                              ? `calc(100% - ${collapseTabWidth}px - 4px)`
                              : isExpanderShown
                                ? `calc(${dividerPosition}% - ${collapseTabWidth}px + 1px)`
                                : `calc(${dividerPosition}% - ${resizePanelWidth}px - 4px)`;
    const resourceWidthStyle = {width: resourceWidth};
    const isChatEnabled = user.isNetworkedTeacher;
    const openChatPanel = isChatEnabled && showChatPanel;
    const focusTileId = selectedTileIds?.length === 1 ? selectedTileIds[0] : undefined;
    console.log("class nav-tab-panel ");
    console.log(`\tnav-tab-panel ${showChatPanel ? "chat-open" : ""}`);

    return (
      <div className={`resource-and-chat-panel ${isResourceExpanded ? "shown" : ""}`} style={resourceWidthStyle}>
        <div className={`nav-tab-panel ${showChatPanel ? "chat-open" : ""}`}
            ref={elt => this.navTabPanelElt = elt}>
          <Tabs
            selectedIndex={selectedTabIndex}
            onSelect={this.handleSelectTab}
            forceRenderTabPanel={true}
          >
            <div className="top-row">
              <TabList className="top-tab-list">
                { tabs?.map((tabSpec, index) => {
                    const tabClass = `top-tab tab-${tabSpec.tab}
                                      ${selectedTabIndex === index ? "selected" : ""}`;
                    return (
                      <React.Fragment key={tabSpec.tab}>
                        <Tab className={tabClass}>{tabSpec.label}</Tab>
                      </React.Fragment>
                    );
                  })
                }
              </TabList>
              {console.log("\tisChatEnabled:", isChatEnabled)}
              {console.log("\topenChatPanel:", openChatPanel)}
              {console.log(`\tchat-panel-toggle themed ${activeNavTab}`)}


              { isChatEnabled
                  ? !openChatPanel &&
                  // <p> test </p>
                    <div className={`chat-panel-toggle themed ${activeNavTab}`}>
                      {/* The next line of code is commented out, but deliberately not removed,
                          per: https://www.pivotaltracker.com/story/show/179754830 */}
                      {/* <NewCommentsBadge documentKey={focusDocument} /> */}
                      <ChatIcon
                        className={`chat-button ${activeNavTab}`}
                        onClick={this.handleShowChatColumn}
                      />
                    </div>
                  : <button className="close-button" onClick={this.handleCloseResources}/>
              }
            </div>
            { tabs?.map((tabSpec) => {
                return (
                  <TabPanel key={tabSpec.tab}>
                    {this.renderTabContent(tabSpec)}
                  </TabPanel>
                );
              })
            }
          </Tabs>
          {showChatPanel &&
            <ChatPanel user={user} activeNavTab={activeNavTab} focusDocument={focusDocument} focusTileId={focusTileId}
                        onCloseChatPanel={this.handleShowChatColumn} />}
        </div>
      </div>
    );
  }

  private renderTabContent = (tabSpec: NavTabSpec) => {
    switch (tabSpec.tab) {
      case ENavTab.kProblems:
        return this.renderProblem();
      case ENavTab.kTeacherGuide:
        return this.renderTeacherGuide();
      case ENavTab.kStudentWork:
        return <StudentGroupView groupId={this.stores.ui.activeGroupId} setGroupId={this.selectStudentGroup} />;
      case ENavTab.kClassWork:
      case ENavTab.kLearningLog:
      case ENavTab.kMyWork:
      case ENavTab.kSupports:
        return this.renderDocuments(tabSpec);
      default:
        return null;
    }
  };

  private renderDocuments = (tabSpec: NavTabSpec) => {
    const { ui: { showChatPanel } } = this.stores;
    return (
      <SectionDocumentOrBrowser
        tabSpec={tabSpec}
        isChatOpen={showChatPanel}
      />
    );
  };

  private renderProblem = () => {
    const { user: { isTeacher }, problem: { sections }} = this.stores;
    return (
      <ProblemTabContent
        sections={sections}
        showSolutionsSwitch={isTeacher}
      />
    );
  };

  private renderTeacherGuide = () => {
    const { user: { isTeacher }, teacherGuide } = this.stores;
    const sections = teacherGuide?.sections;
    return isTeacher && sections && (
      <ProblemTabContent
        context={ENavTab.kTeacherGuide}
        sections={sections}
        showSolutionsSwitch={false}
      />
    );
  };

  private handleSelectTab = (tabIndex: number) => {
    const { tabs } = this;
    const { ui } = this.stores;
    if (tabs) {
      const tabSpec = tabs[tabIndex];
      if (ui.activeNavTab !== tabSpec.tab) {
        ui.setActiveNavTab(tabSpec.tab);
        const logParameters = {
          tab_name: tabSpec.tab.toString()
        };
        const logEvent = () => { Logger.log(LogEventName.SHOW_TAB, logParameters); };
        logEvent();
      } else {
        if (ui.openSubTab) {
          // If there is a document open then a click on the active top level tab
          // closes the document. Also a click on the active sub tab closes the
          // document, this is handled in section-document-or-browser
          ui.closeSubTabDocument(tabSpec.tab, ui.openSubTab);
        }
      }
    }
  };

  private selectStudentGroup = (groupId: string) => {
    const { ui } = this.stores;
    ui.setActiveStudentGroup(groupId);
  };

  private handleShowChatColumn = () => {
    const { ui } = this.stores;
    const event = ui.showChatPanel ? LogEventName.CHAT_PANEL_HIDE : LogEventName.CHAT_PANEL_SHOW;
    console.log("\t 📁 handleShowChatColumn log event:", event);
    Logger.log(event);
    ui.toggleShowChatPanel(!ui.showChatPanel);
  };

  private handleCloseResources = () => {
    const { ui } = this.stores;
    ui.setDividerPosition(kDividerMin);
  };
}
