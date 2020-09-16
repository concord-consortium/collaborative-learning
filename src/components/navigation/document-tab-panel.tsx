import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { ENavTabSectionType, NavTabSectionModelType, NavTabSpec  } from "../../models/view/nav-tabs";
import { IStores } from "../../models/stores/stores";
import { TabPanelDocumentsSection } from "../thumbnail/tab-panel-documents-section";
import { DocumentDragKey, DocumentModelType, SupportPublication } from "../../models/document/document";
import { LogEventName, Logger } from "../../lib/logger";

import "./document-tab-panel.sass";

interface IProps extends IBaseProps {
  tabSpec: NavTabSpec;
  selectedDocument?: string;
  selectedSection?: ENavTabSectionType;
  onSelectNewDocument?: (type: string) => void;
  onSelectDocument?: (document: DocumentModelType) => void;
  onTabClick?: (title: string, type: string) => void;
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
    const { documentView, tabSpec, selectedDocument,
            onSelectNewDocument, onSelectDocument, onTabClick } = this.props;
    const { tabIndex } = this.state;
    const { user } = this.stores;
    const navTabSpecs = this.stores.appConfig.navTabs.tabSpecs;
    const navTabSpec = navTabSpecs.find(spec => spec.tab === tabSpec.tab);
    return (
      <Tabs
        className={`document-tabs ${navTabSpec?.tab}`}
        forceRenderTabPanel={true}
        onSelect={this.handleTabSelect}
        selectedIndex={tabIndex}
        selectedTabClassName="selected"
      >
        <TabList className={`tab-list ${navTabSpec?.tab}`}>
          {navTabSpec?.sections.map((section) => {
            const sectionTitle = this.getSectionTitle(section, this.stores);
            return (
              <Tab
                className={`doc-tab ${navTabSpec?.tab} ${section.type}`}
                key={`section-${section.type}`}
                onClick={() => onTabClick?.(sectionTitle, section.type)}
                data-test={section.dataTestHeader}
              >
                {sectionTitle}
              </Tab>
            );
          })}
        </TabList>
        {navTabSpec?.sections.map((section, index) => {
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
                    tab={navTabSpec!.tab}
                    section={section}
                    stores={this.stores}
                    scale={kNavItemScale}
                    selectedDocument={selectedDocument}
                    onSelectNewDocument={onSelectNewDocument}
                    onSelectDocument={onSelectDocument}
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

  private getSectionTitle = (section: NavTabSectionModelType , stores: IStores) => {
    if (section.title === "%abbrevInvestigation%") {
      const { unit, investigation } = stores;
      const { abbrevTitle } = unit;
      const prefix = abbrevTitle ? `${abbrevTitle}: ` : "";
      return `${prefix}Investigation ${investigation.ordinal}`;
    }
    return section.title;
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
