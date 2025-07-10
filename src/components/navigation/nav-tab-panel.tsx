import { inject, observer } from "mobx-react";
import React from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { BaseComponent, IBaseProps } from "../base";
import { kDividerMin } from "../../models/stores/ui-types";
import { ENavTab, NavTabModelType } from "../../models/view/nav-tabs";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { StudentGroupView } from "../document/student-group-view";
import { ProblemTabContent } from "./problem-tab-content";
import { SectionDocumentOrBrowser } from "./section-document-or-browser";
import { ChatPanel } from "../chat/chat-panel";
import ChatIcon from "../../assets/chat-icon.svg";
import { SortWorkView } from "../document/sort-work-view";

import "react-tabs/style/react-tabs.css";
import "./nav-tab-panel.scss";
import "../themes.scss";

interface IProps extends IBaseProps {
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
}

@inject("stores")
@observer
export class NavTabPanel extends BaseComponent<IProps> {

  private navTabPanelElt: HTMLDivElement | null = null;

  constructor(props: IProps) {
    super(props);
  }

  public render() {
    const { persistentUI: { activeNavTab, focusDocument, showChatPanel }, ui: { selectedTileIds },
            user, appConfig } = this.stores;
    const tabs = this.stores.tabsToDisplay;
    const selectedTabIndex = tabs?.findIndex(t => t.tab === activeNavTab);
    const isChatEnabled = appConfig.showCommentPanelFor(user.type) &&
      !this.shouldHideChat(selectedTabIndex, user.type);
    const openChatPanel = isChatEnabled && showChatPanel;
    const focusTileId = selectedTileIds?.length === 1 ? selectedTileIds[0] : undefined;

    return (
      <div className="resource-and-chat-panel">
        <div className="nav-tab-panel"
            ref={elt => this.navTabPanelElt = elt}>
          <Tabs
            className={["react-tabs", "top-level-tabs"]}
            selectedIndex={selectedTabIndex}
            onSelect={this.handleSelectTab}
            forceRenderTabPanel={true}
          >
            <div className="top-row">
              <TabList className="top-tab-list">
                { tabs?.map((tabSpec, index) => {
                    const tabClass = `top-tab tab-${tabSpec.tab}
                                      ${selectedTabIndex === index ? "selected" : ""}`;
                    let dataTestId = undefined;
                    if (tabSpec.tab === 'teacher-guide') dataTestId = 'nav-tab-teacher-guide';
                    if (tabSpec.tab === 'student-work') dataTestId = 'nav-tab-student-work';
                    if (tabSpec.tab === 'class-work') dataTestId = 'nav-tab-class-work';
                    return (
                      <React.Fragment key={tabSpec.tab}>
                        <Tab className={tabClass} data-testid={dataTestId}>{tabSpec.label}</Tab>
                      </React.Fragment>
                    );
                  })
                }
              </TabList>
              { isChatEnabled
                  ? !openChatPanel &&
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
                  <TabPanel key={tabSpec.tab} className={["react-tabs__tab-panel", "top-level-tab-panel"]}>
                    {this.renderTabContent(tabSpec)}
                  </TabPanel>
                );
              })
            }
          </Tabs>
          {showChatPanel && activeNavTab &&
            <ChatPanel user={user} activeNavTab={activeNavTab} focusDocument={focusDocument} focusTileId={focusTileId}
                        onCloseChatPanel={this.handleShowChatColumn} />}
        </div>
      </div>
    );
  }

  private renderTabContent = (tabSpec: NavTabModelType) => {
    switch (tabSpec.tab) {
      case ENavTab.kProblems:
        return this.renderProblem();
      case ENavTab.kTeacherGuide:
        return this.renderTeacherGuide();
      case ENavTab.kStudentWork:
        return <StudentGroupView/>;
      case ENavTab.kSortWork:
        return <SortWorkView/>;
      case ENavTab.kClassWork:
      case ENavTab.kLearningLog:
      case ENavTab.kMyWork:
      case ENavTab.kSupports:
        return this.renderDocuments(tabSpec);
      default:
        return null;
    }
  };

  private renderDocuments = (tabSpec: NavTabModelType) => {
    const { persistentUI: { showChatPanel } } = this.stores;
    return (
      <SectionDocumentOrBrowser
        tabSpec={tabSpec}
        isChatOpen={showChatPanel}
      />
    );
  };

  private renderProblem = () => {
    const { user: { isTeacherOrResearcher }, problem: { sections }} = this.stores;
    return (
      <ProblemTabContent
        sections={sections}
        showSolutionsSwitch={isTeacherOrResearcher}
      />
    );
  };

  private renderTeacherGuide = () => {
    const { user: { isTeacherOrResearcher }, teacherGuide } = this.stores;
    const sections = teacherGuide?.sections;
    return isTeacherOrResearcher && sections && (
      <ProblemTabContent
        context={ENavTab.kTeacherGuide}
        sections={sections}
        showSolutionsSwitch={false}
      />
    );
  };

  private handleSelectTab = (tabIndex: number) => {
    const tabs = this.stores.tabsToDisplay;
    const { persistentUI } = this.stores;
    if (tabs) {
      const tabSpec = tabs[tabIndex];
      if (persistentUI.activeNavTab !== tabSpec.tab) {
        persistentUI.setActiveNavTab(tabSpec.tab);
        const logParameters = {
          tab_name: tabSpec.tab.toString()
        };
        const logEvent = () => { Logger.log(LogEventName.SHOW_TAB, logParameters); };
        logEvent();
      } else {
        if (persistentUI.currentDocumentGroupId) {
          // If there is a document open then a click on the active top level tab
          // closes the document. Also a click on the active sub tab closes the
          // document, this is handled in section-document-or-browser
          persistentUI.closeDocumentGroupPrimaryDocument(tabSpec.tab, persistentUI.currentDocumentGroupId);
        }
      }
    }
  };

  private handleShowChatColumn = () => {
    const { persistentUI } = this.stores;
    const event = persistentUI.showChatPanel ? LogEventName.CHAT_PANEL_HIDE : LogEventName.CHAT_PANEL_SHOW;
    Logger.log(event);
    persistentUI.toggleShowChatPanel(!persistentUI.showChatPanel);
  };

  private handleCloseResources = () => {
    const { persistentUI } = this.stores;
    persistentUI.setDividerPosition(kDividerMin);
  };

  private hideChatRules: Array<(tabIndex: number, userType: string) => boolean> = [
    // Hide chat for students on the problems tab
    (tabIndex, userType) => userType === "student" && tabIndex === 0
  ];

  private shouldHideChat = (tabIndex: number, userType?: string) => {
    return userType && this.hideChatRules.some(rule => rule(tabIndex, userType));
  };
}
