import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { kDividerMax, kDividerMin } from "../../models/stores/ui-types";
import { NavTabSpec, ENavTab } from "../../models/view/nav-tabs";
import { Logger, LogEventName } from "../../lib/logger";
import { StudentGroupView } from "../document/student-group-view";
import { ProblemTabContent } from "./problem-tab-content";
import { DocumentTabContent } from "./document-tab-content";
import { SupportBadge } from "./support-badge";
import { ChatPanel } from "../chat/chat-panel";
import ChatIcon from "../../assets/chat-icon.svg";

import "react-tabs/style/react-tabs.css";
import "./nav-tab-panel.sass";
import "../themes.scss";

interface IProps extends IBaseProps {
  tabs?: NavTabSpec[];
  isResourceExpanded: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

interface IState {
  tabLoadAllowed: { [tab: number]: boolean };
  showChatColumn: boolean;
}

@inject("stores")
@observer
export class NavTabPanel extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      tabLoadAllowed: {},
      showChatColumn: false,
    };
  }

  public render() {
    const { tabs, isResourceExpanded } = this.props;
    const { ui, user, documents, supports } = this.stores;
    const selectedTabIndex = tabs?.findIndex(t => t.tab === ui.activeNavTab);
    const resizePanelWidth = 4;
    const collapseTabWidth = 44;
    const resourceWidth = ui.dividerPosition === kDividerMin
                            ? kDividerMin
                            : ui.dividerPosition === kDividerMax
                              ? `calc(100% - ${collapseTabWidth}px - ${resizePanelWidth}px)`
                              : `calc(${ui.dividerPosition}% - ${resizePanelWidth}px)`;
    const resourceWidthStyle = {width: resourceWidth};
    const referenceDocument = ui.referenceDocument && documents.getDocument(ui.referenceDocument);
    const newCommentCount = 8;
    return (
      <div className={`resource-and-chat-panel ${isResourceExpanded ? "shown" : ""}`} style={resourceWidthStyle}>
        <div className={`nav-tab-panel ${this.state.showChatColumn ? "chat-open" : ""}`}>
          <Tabs selectedIndex={selectedTabIndex} onSelect={this.handleSelectTab} forceRenderTabPanel={true}>
            <div className="top-row">
              <TabList className="top-tab-list">
                { tabs?.map((tabSpec, index) => {
                    const tabClass = `top-tab tab-${tabSpec.tab}
                                      ${selectedTabIndex === index ? "selected" : ""}`;
                    return (
                      <React.Fragment key={tabSpec.tab}>
                        <Tab className={tabClass}>{tabSpec.label}</Tab>
                        {(tabSpec.tab === "supports") && <SupportBadge user={user} supports={supports} /> }
                      </React.Fragment>
                    );
                  })
                }
              </TabList>
              { user.isNetworkedTeacher
                  ? (!this.state.showChatColumn) &&
                    <div className={`chat-panel-toggle themed ${ui.activeNavTab}`}>
                      <div className="new-comment-badge">{newCommentCount}</div>
                      <ChatIcon
                        className={`chat-button ${ui.activeNavTab}`}
                        onClick={() => this.handleShowChatColumn(true)}
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
          {this.state.showChatColumn && referenceDocument &&
            <ChatPanel activeNavTab={ui.activeNavTab} document={referenceDocument.getMetadata()}
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
  }

  private renderDocuments = (tabSpec: NavTabSpec) => {
    return (
      <DocumentTabContent tabSpec={tabSpec} isChatOpen={this.state.showChatColumn}/>
    );
  }

  private renderProblem = () => {
    const { user: { isTeacher }, problem: { sections } } = this.stores;
    return (
      <ProblemTabContent
        sections={sections}
        showSolutionsSwitch={isTeacher}
        isChatOpen={this.state.showChatColumn}/>
    );
  }

  private renderTeacherGuide = () => {
    const { user: { isTeacher }, teacherGuide } = this.stores;
    const sections = teacherGuide?.sections;
    return isTeacher && sections && (
      <ProblemTabContent
        context={ENavTab.kTeacherGuide}
        sections={sections}
        showSolutionsSwitch={false}
        isChatOpen={this.state.showChatColumn}/>
    );
  }

  private handleSelectTab = (tabIndex: number) => {
    const { tabs } = this.props;
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
      }
    }
  }

  private selectStudentGroup = (groupId: string) => {
    const { ui } = this.stores;
    ui.setActiveStudentGroup(groupId);
  }

  private handleShowChatColumn = (show: boolean) => {
    this.setState({showChatColumn: show});
  }

  private handleCloseResources = () => {
    const { ui } = this.stores;
    ui.setDividerPosition(kDividerMin);
  }
}
