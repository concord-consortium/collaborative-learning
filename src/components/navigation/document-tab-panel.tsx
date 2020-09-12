import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { EContentTabSectionType, ContentTabSpec, ContentTabSectionModelType } from "../../models/view/left-tabs";
import { IStores } from "../../models/stores/stores";
import { TabPanelDocumentsSection } from "../thumbnail/tab-panel-documents-section";
import { DocumentDragKey, DocumentModelType, SupportPublication } from "../../models/document/document";
import { LogEventName, Logger } from "../../lib/logger";

import "./document-tab-panel.sass";

interface IProps extends IBaseProps {
  tabSpec: ContentTabSpec;
  onDocumentClick?: (document: DocumentModelType) => void;
  onTabClick?: () => void;
  documentView?: React.ReactNode;
}

interface IState {
  tabIndex: number;
}

const kNavItemScale = 0.11;

@inject("stores")
@observer
export class DocumentTabPanel extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      tabIndex: 0
    };
  }

  public render() {
    const { documentView, tabSpec, onTabClick, onDocumentClick } = this.props;
    const { tabIndex } = this.state;
    const { user } = this.stores;
    const leftTabSpecs = this.stores.appConfig.leftTabs.tabSpecs;
    const leftTabSpec = leftTabSpecs.find(spec => spec.tab === tabSpec.tab);
    return (
      <Tabs
        className={`document-tabs ${leftTabSpec?.tab}`}
        forceRenderTabPanel={true}
        onSelect={this.handleTabSelect}
        selectedIndex={tabIndex}
        selectedTabClassName="selected"
      >
        <TabList className={`tab-list ${leftTabSpec?.tab}`} onClick={onTabClick}>
          {leftTabSpec?.sections.map((section) => {
            const sectionTitle = this.getSectionTitle(section, this.stores);
            return (
              <Tab
                className={`doc-tab ${leftTabSpec?.tab} ${section.type}`}
                key={`section-${section.type}`}
                data-test={section.dataTestHeader}
              >
                {sectionTitle}
              </Tab>
            );
          })}
        </TabList>
        {leftTabSpec?.sections.map((section, index) => {
          const _handleDocumentStarClick = section.showStarsForUser(user)
                ? this.handleDocumentStarClick
                : undefined;
          const _handleDocumentDeleteClick = section.showDeleteForUser(user)
                ? this.handleDocumentDeleteClick
                : undefined;
          return (
            <TabPanel key={`section-${section.type}`}>
              { documentView && (index === tabIndex)
                ? documentView
                : <TabPanelDocumentsSection
                    key={section.type}
                    tab={leftTabSpec!.tab}
                    section={section}
                    stores={this.stores}
                    scale={kNavItemScale}
                    onNewDocumentClick={this.handleNewDocumentClick}
                    onDocumentClick={onDocumentClick || this.handleDocumentClick}
                    onDocumentDragStart={this.handleDocumentDragStart}
                    onDocumentStarClick={_handleDocumentStarClick}
                    onDocumentDeleteClick={_handleDocumentDeleteClick}
                  /> }
            </TabPanel>
          );
        })}
      </Tabs>
    );
  }

  private getSectionTitle = (section: ContentTabSectionModelType, stores: IStores) => {
    if (section.title === "%abbrevInvestigation%") {
      const { unit, investigation } = stores;
      const { abbrevTitle } = unit;
      const prefix = abbrevTitle ? `${abbrevTitle}: ` : "";
      return `${prefix}Investigation ${investigation.ordinal}`;
    }
    return section.title;
  }

  private handleNewDocumentClick = async (section: ContentTabSectionModelType) => {
    const { appConfig: { defaultDocumentContent }, db, ui } = this.stores;
    const { problemWorkspace } = ui;

    const newDocument = section.type === EContentTabSectionType.kLearningLogs
      ? await db.createLearningLogDocument()
      : await db.createPersonalDocument({ content: defaultDocumentContent });

    if (newDocument) {
      problemWorkspace.setAvailableDocument(newDocument);
      ui.restoreDefaultNavExpansion();
    }
  }

  private handleDocumentClick = (document: DocumentModelType) => {
    const { appConfig, ui } = this.stores;
    ui.rightNavDocumentSelected(appConfig, document);
  }

  private handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => {
    e.dataTransfer.setData(DocumentDragKey, document.key);
  }

  private handleDocumentStarClick = (document: DocumentModelType) => {
    const { user } = this.stores;
    document?.toggleUserStar(user.id);
  }

  private handleDocumentDeleteClick = (document: DocumentModelType) => {
    const {ui} = this.stores;
    ui.confirm("Do you want to delete this?", "Confirm Delete")
      .then(ok => {
        if (ok) {
          document.setProperty("isDeleted", "true");
          if (document.type === SupportPublication) {
            Logger.logDocumentEvent(LogEventName.DELETE_SUPPORT, document);
          }
        }
      });
  }

  private handleTabSelect = (tabIndex: number) => {
    this.setState({ tabIndex });
  }

}
