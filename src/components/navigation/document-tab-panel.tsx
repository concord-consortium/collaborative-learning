import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { ENavTabSectionType, NavTabSectionSpec, NavTabSpec }
  from "../../models/view/nav-tabs";
import { TabPanelDocumentsSection } from "../thumbnail/tab-panel-documents-section";
import { DocumentModelType } from "../../models/document/document";
import { DocumentDragKey, SupportPublication } from "../../models/document/document-types";
import { LogEventName, Logger } from "../../lib/logger";
import { NetworkDocumentsSection } from "./network-documents-section";

import "./document-tab-panel.sass";

interface IProps extends IBaseProps {
  tabSpec: NavTabSpec;
  selectedDocument?: string;
  selectedSection?: ENavTabSectionType;
  onSelectNewDocument?: (type: string) => void;
  onSelectDocument?: (document: DocumentModelType) => void;
  onTabClick?: (title: string, type: string) => void;
  documentView?: React.ReactNode;
  isChatOpen?: boolean;
  showNetworkDocuments?: boolean;
}

interface IState {
  tabIndex: number;
}

const kNavItemScale = 0.11;
const kHeaderHeight = 55;
const kWorkspaceContentMargin = 4;
const kNavTabHeight = 34;
const kTabSectionBorderWidth = 2;

export interface ISubTabSpec {
  label: string;
  sections: NavTabSectionSpec[];
}

@inject("stores")
@observer
export class DocumentTabPanel extends BaseComponent<IProps, IState> {

  subTabs: ISubTabSpec[] = [];

  constructor(props: IProps) {
    super(props);
    this.state = {
      tabIndex: 0
    };

    // combine sections with matching titles into a single tab with sub-sections
    props.tabSpec.sections?.forEach(section => {
      const found = this.subTabs.findIndex(tab => tab.label === section.title);
      if (found >= 0) {
        this.subTabs[found].sections.push(section);
      }
      else {
        this.subTabs.push({ label: section.title, sections: [section] });
      }
    });
  }

  public componentDidMount() {
    const { selectedSection, tabSpec } = this.props;
    if (selectedSection) {
      const selectedIndex = tabSpec.sections?.findIndex(spec => spec.type === selectedSection);
      if (selectedIndex != null) {
        this.setState({ tabIndex: selectedIndex });
      }
    }
  }

  public render() {
    const { appConfig: { navTabs } } = this.stores;
    const { documentView, tabSpec, onTabClick, isChatOpen } = this.props;
    const { tabIndex } = this.state;
    const navTabSpec = navTabs.getNavTabSpec(tabSpec.tab);
    const hasSubTabs = this.subTabs.length > 1;
    const vh = window.innerHeight;
    const headerOffset = hasSubTabs
                          ? kHeaderHeight + (2 * (kWorkspaceContentMargin + kNavTabHeight + kTabSectionBorderWidth))
                          : kHeaderHeight + kNavTabHeight + (2 * (kWorkspaceContentMargin + kTabSectionBorderWidth));
    const documentsPanelHeight = vh - headerOffset;
    const documentsPanelStyle = { height: documentsPanelHeight };

    return (
      <Tabs
        className={`document-tabs ${navTabSpec?.tab} ${isChatOpen ? "chat-open" : ""}`}
        forceRenderTabPanel={true}
        onSelect={this.handleTabSelect}
        selectedIndex={tabIndex}
        selectedTabClassName="selected"
      >
        <div className={`tab-header-row ${!hasSubTabs ? "no-sub-tabs" : ""}`}>
          <TabList className={`tab-list ${navTabSpec?.tab}`}>
            {this.subTabs.map((subTab) => {
              const sectionTitle = subTab.label.toLowerCase().replace(' ', '-');
              const type = subTab.sections[0].type;
              return (
                <Tab className={`doc-tab ${navTabSpec?.tab} ${sectionTitle} ${type}`}
                  key={`section-${sectionTitle}`}
                  onClick={() => onTabClick?.(subTab.label, type)}>
                  {subTab.label}
                </Tab>
              );
            })}
          </TabList>
        </div>
        <div className="documents-panel" style={documentsPanelStyle}>
          {this.subTabs.map((subTab, index) => {
            const sectionTitle = subTab.label.toLowerCase().replace(' ', '-');
            return (
              <TabPanel key={`subtab-${subTab.label}`} data-test={`subtab-${sectionTitle}`}>
                { documentView && (index === tabIndex)
                  ? documentView
                  : this.renderSubSections(subTab)
                }
              </TabPanel>
            );
          })}
        </div>
      </Tabs>
    );
  }

  private handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => {
    e.dataTransfer.setData(DocumentDragKey, document.key);
  };

  private handleDocumentStarClick = (document: DocumentModelType) => {
    const { user } = this.stores;
    document?.toggleUserStar(user.id);
  };

  private handleDocumentDeleteClick = (document: DocumentModelType) => {
    const { ui } = this.stores;
    ui.confirm("Do you want to delete this?", "Confirm Delete")
      .then(ok => {
        if (ok) {
          document.setProperty("isDeleted", "true");
          if (document.type === SupportPublication) {
            Logger.logDocumentEvent(LogEventName.DELETE_SUPPORT, document);
          }
        }
      });
  };

  private handleTabSelect = (tabIndex: number) => {
    this.setState({ tabIndex });
    this.stores.ui.updateFocusDocument();
  };

  private handleDocumentSelect = (document: DocumentModelType) => {
    const { onSelectDocument } = this.props;
    const logEvent = document.isRemote
      ? LogEventName.VIEW_SHOW_TEACHER_NETWORK_COMPARISON_DOCUMENT
      : LogEventName.VIEW_SHOW_COMPARISON_DOCUMENT;
    Logger.logDocumentEvent(logEvent, document);

    onSelectDocument?.(document);
  };

  private renderSubSections(subTab: ISubTabSpec) {
    const { selectedDocument, onSelectNewDocument, showNetworkDocuments } = this.props;
    const { user } = this.stores;
    const classHash = this.stores.class.classHash;
    return (
      <div>
        { subTab.sections.map((section: any, index: any) => {
            const _handleDocumentStarClick = section.showStarsForUser(user)
              ? this.handleDocumentStarClick
              : undefined;
            const _handleDocumentDeleteClick = section.showDeleteForUser(user)
              ? this.handleDocumentDeleteClick
              : undefined;
            return (
              <TabPanelDocumentsSection
                key={section.type}
                tab={subTab.label}
                section={section}
                index={index}
                numSections={subTab.sections.length}
                stores={this.stores}
                scale={kNavItemScale}
                selectedDocument={selectedDocument}
                onSelectNewDocument={onSelectNewDocument}
                onSelectDocument={this.handleDocumentSelect}
                onDocumentDragStart={this.handleDocumentDragStart}
                onDocumentStarClick={_handleDocumentStarClick}
                onDocumentDeleteClick={_handleDocumentDeleteClick}
              />
            );
          })
        }
        { showNetworkDocuments &&
          <NetworkDocumentsSection
            currentClassHash={classHash}
            currentTeacherName={user.name}
            currentTeacherId={user.id}
            subTab={subTab}
            problemTitle={this.stores.problem.title}
            stores={this.stores}
            scale={kNavItemScale}
            onSelectDocument={this.handleDocumentSelect}
          />}
      </div>
    );
  }
}
