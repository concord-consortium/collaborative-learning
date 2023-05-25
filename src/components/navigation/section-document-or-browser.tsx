import React, { useCallback, useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import { useQueryClient } from 'react-query';
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { DocumentModelType } from "../../models/document/document";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import { logDocumentEvent } from "../../models/document/log-document-event";
import { NavTabSectionSpec, NavTabSpec } from "../../models/view/nav-tabs";
import { EditableDocumentContent } from "../document/editable-document-content";
import { useAppConfig, useClassStore, useProblemStore, useStores,
  useUIStore, useUserStore } from "../../hooks/use-stores";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { useUserContext } from "../../hooks/use-user-context";
import { DocumentCollectionByType } from "../thumbnail/documents-type-collection";
import { DocumentDragKey, SupportPublication } from "../../models/document/document-types";
import { NetworkDocumentsSection } from "./network-documents-section";
import EditIcon from "../../clue/assets/icons/edit-right-icon.svg";

import "./section-document-or-browser.sass";

const kNavItemScale = 0.11;
const kHeaderHeight = 55;
const kWorkspaceContentMargin = 4;
const kNavTabHeight = 34;
const kTabSectionBorderWidth = 2;

interface IProps {
  tabSpec: NavTabSpec;
  reset?: () => void;
  isChatOpen?: boolean;
}

export interface ISubTabSpec {
  label: string;
  sections: NavTabSectionSpec[];
}

export const SectionDocumentOrBrowser: React.FC<IProps> = observer(function SectionDocumentOrBrowser(
    { tabSpec, reset, isChatOpen }) {
  const ui = useUIStore();
  const store = useStores();
  const appConfigStore = useAppConfig();
  const problemStore = useProblemStore();
  const context = useUserContext();
  const queryClient = useQueryClient();
  const user = useUserStore();
  const classStore = useClassStore();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);

  const subTabs = useMemo<ISubTabSpec[]>(() => {
    const _subTabs: ISubTabSpec[] = [];
    // combine sections with matching titles into a single tab with sub-sections
    tabSpec.sections?.forEach(section => {
      const found = _subTabs.findIndex(tab => tab.label === section.title);
      if (found >= 0) {
        _subTabs[found].sections.push(section);
      }
      else {
        _subTabs.push({ label: section.title, sections: [section] });
      }
    });
    return _subTabs;
  }, [tabSpec.sections]);

  const hasSubTabs = subTabs.length > 1;
  const vh = window.innerHeight;
  const headerOffset = hasSubTabs
                        ? kHeaderHeight + (2 * (kWorkspaceContentMargin + kNavTabHeight + kTabSectionBorderWidth))
                        : kHeaderHeight + kNavTabHeight + (2 * (kWorkspaceContentMargin + kTabSectionBorderWidth));
  const documentsPanelHeight = vh - headerOffset;
  const documentsPanelStyle = { height: documentsPanelHeight };

  const tabState = navTabSpec && ui.tabs.get(navTabSpec?.tab);

  useEffect(() => {
    // Set the initial open tab. If the tabSpec changes somehow then the open
    // sub tab will get reset
    ui.setOpenSubTab(tabSpec.tab, subTabs[0].label);
  }, [subTabs, tabSpec.tab, ui]);

  // FIXME: this should be handled by handleTabSelect instead of TabClick
  // However there is some magic where if a document is opened then clicking
  // on the tab will revert its view back to the browse view.
  const handleTabClick = useCallback((title: string, type?: string) => {
    if (tabState?.openSubTab === title && tabState?.openDocuments.get(title)) {
      // If there is a document open then a click on the tab should close
      // the document
      ui.closeSubTabDocument(tabSpec.tab, title);
    }
    Logger.log(LogEventName.SHOW_TAB_SECTION, {
      tab_section_name: title,
      tab_section_type: type
    });
  },[tabSpec.tab, tabState?.openDocuments, tabState?.openSubTab, ui]);

  const handleTabSelect = (tabidx: number) => {
    const selectedSubTab = subTabs[tabidx];

    ui.setOpenSubTab(tabSpec.tab, selectedSubTab.label);
  };

  const handleSelectDocument = (document: DocumentModelType) => {
    if (!document.hasContent && document.isRemote) {
      loadDocumentContent(document);
    }
    const selectedSubTab = subTabs[tabIndex];
    ui.openSubTabDocument(tabSpec.tab, selectedSubTab.label, document.key);
    const logEvent = document.isRemote
      ? LogEventName.VIEW_SHOW_TEACHER_NETWORK_COMPARISON_DOCUMENT
      : LogEventName.VIEW_SHOW_COMPARISON_DOCUMENT;
    logDocumentEvent(logEvent, { document });
  };

  const loadDocumentContent = async (document: DocumentModelType) => {
    await document.fetchRemoteContent(queryClient, context);
  };

  function handleEditClick(document: DocumentModelType) {
    ui.problemWorkspace.setPrimaryDocument(document);
  }

  // TODO: this edit button is confusing when the history is being viewed. It
  // opens the original document for editing, not some old version of the
  // document they might be looking at. Previously this edit button was disabled
  // when the history document was being shown because SectionDocumentOrBrowser
  // knew the state of playback controls. It no longer knows that state, so now
  // the edit button is shown all of the time.
  // PT Story: https://www.pivotaltracker.com/story/show/183416176
  const editButton = (type: string, sClass: string, document: DocumentModelType) => {
    return (
      (type === "my-work") || (type === "learningLog")
        ?
          <div className={`edit-button ${sClass}`}
                onClick={() => handleEditClick(document)}>
            <EditIcon className={`edit-icon ${sClass}`} />
            <div>Edit</div>
          </div>
        : null
    );
  };

  const handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => {
    e.dataTransfer.setData(DocumentDragKey, document.key);
  };

  const handleDocumentStarClick = (document: DocumentModelType) => {
    document?.toggleUserStar(user.id);
  };

  const handleDocumentDeleteClick = (document: DocumentModelType) => {
    ui.confirm("Do you want to delete this?", "Confirm Delete")
      .then(ok => {
        if (ok) {
          document.setProperty("isDeleted", "true");
          if (document.type === SupportPublication) {
            logDocumentEvent(LogEventName.DELETE_SUPPORT, { document });
          }
        }
      });
  };

  const renderDocumentBrowserView = (subTab: ISubTabSpec) => {
    const openDocumentKey = tabState?.openDocuments.get(subTab.label);
    const classHash = classStore.classHash;
    return (
      <div>
        {
          subTab.sections.map((section: any, index: any) => {
            const _handleDocumentStarClick = section.showStarsForUser(user)
              ? handleDocumentStarClick
              : undefined;

            return (
              <DocumentCollectionByType
                key={`${section.type}_${index}`}
                topTab={navTabSpec?.tab}
                tab={subTab.label}
                section={section}
                index={index}
                numSections={subTab.sections.length}
                scale={kNavItemScale}
                selectedDocument={openDocumentKey}
                onSelectDocument={handleSelectDocument}
                onDocumentDragStart={handleDocumentDragStart}
                onDocumentStarClick={_handleDocumentStarClick}
                onDocumentDeleteClick={handleDocumentDeleteClick}
              />
            );
          })
        }
        {
          user.isNetworkedTeacher &&
          <NetworkDocumentsSection
            currentClassHash={classHash}
            currentTeacherName={user.name}
            currentTeacherId={user.id}
            subTab={subTab}
            problemTitle={problemStore.title}
            scale={kNavItemScale}
            onSelectDocument={handleSelectDocument}
          />
        }
      </div>
    );
  };

  const showPlayback = user.type ? appConfigStore.enableHistoryRoles.includes(user.type) : false;
  const renderDocumentView = (subTab: ISubTabSpec) => {
    const openDocumentKey = tabState?.openDocuments.get(subTab.label) || "";
    const openDocument = store.documents.getDocument(openDocumentKey) ||
      store.networkDocuments.getDocument(openDocumentKey);

    if (!openDocument || openDocument.getProperty("isDeleted")) return false;

    const sectionClass = openDocument?.type === "learningLog" ? "learning-log" : "";

    return (
      <div>
        <div className={`document-header ${tabSpec.tab} ${sectionClass}`} onClick={() => ui.setSelectedTile()}>
          <div className={`document-title`}>
            {getDocumentDisplayTitle(openDocument, appConfigStore, problemStore)}
          </div>
          {(!openDocument.isRemote)
              && editButton(tabSpec.tab, sectionClass, openDocument)}
        </div>
        <EditableDocumentContent
          mode={"1-up"}
          isPrimary={false}
          document={openDocument}
          readOnly={true}
          showPlayback={showPlayback}
        />
      </div>
    );
  };

  const subTabIndex = subTabs.findIndex((subTab) => tabState?.openSubTab === subTab.label);
  const tabIndex = subTabIndex < 0 ? 0 : subTabIndex;

  return (
    <div className="document-tab-content">
      <Tabs
        className={`document-tabs ${navTabSpec?.tab} ${isChatOpen ? "chat-open" : ""}`}
        forceRenderTabPanel={true}
        onSelect={handleTabSelect}
        selectedIndex={tabIndex}
        selectedTabClassName="selected"
      >
        <div className={`tab-header-row ${!hasSubTabs ? "no-sub-tabs" : ""}`}>
          <TabList className={`tab-list ${navTabSpec?.tab}`}>
            {subTabs.map((subTab) => {
              const sectionTitle = subTab.label.toLowerCase().replace(' ', '-');
              const type = subTab.sections[0].type;
              return (
                <Tab className={`doc-tab ${navTabSpec?.tab} ${sectionTitle} ${type}`}
                  key={`section-${sectionTitle}`}
                  onClick={() => handleTabClick?.(subTab.label, type)}>
                  {subTab.label}
                </Tab>
              );
            })}
          </TabList>
        </div>
        <div className="documents-panel" style={documentsPanelStyle}>
          {subTabs.map((subTab, index) => {
            const sectionTitle = subTab.label.toLowerCase().replace(' ', '-');
            return (
              <TabPanel key={`subtab-${subTab.label}`} data-test={`subtab-${sectionTitle}`}>
                { renderDocumentView(subTab) || renderDocumentBrowserView(subTab) }
              </TabPanel>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
});
