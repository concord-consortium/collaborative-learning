import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useQueryClient } from 'react-query';
import classNames from "classnames";
import { DocumentModelType } from "../../models/document/document";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import { logDocumentEvent } from "../../models/document/log-document-event";
import { ISubTabSpec, NavTabModelType } from "../../models/view/nav-tabs";
import { EditableDocumentContent } from "../document/editable-document-content";
import { useAppConfig, useClassStore, useProblemStore, useStores,
  useUIStore, useUserStore } from "../../hooks/use-stores";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { useUserContext } from "../../hooks/use-user-context";
import { NetworkDocumentsSection } from "./network-documents-section";
import EditIcon from "../../clue/assets/icons/edit-right-icon.svg";
import { DocumentCollectionList, kNavItemScale } from "../thumbnail/document-collection-list";
import { SubTabsPanel } from "./sub-tabs-panel";
import CollapseScrollerIcon from "../../assets/show-hide-document-view-icon.svg";
import ScrollArrowIcon from "../../assets/scroll-arrow-icon.svg";

import "./section-document-or-browser.sass";

interface IProps {
  tabSpec: NavTabModelType;
  isChatOpen?: boolean;
}

export const SectionDocumentOrBrowser: React.FC<IProps> = observer(function SectionDocumentOrBrowser(
    { tabSpec, isChatOpen }) {
  const ui = useUIStore();
  const store = useStores();
  const appConfigStore = useAppConfig();
  const problemStore = useProblemStore();
  const context = useUserContext();
  const queryClient = useQueryClient();
  const user = useUserStore();
  const classStore = useClassStore();
  const [scrollerCollapsed, setScrollerCollapsed] = useState(false);
  const [showLeftScrollArrow, setShowLeftScrollArrow] = useState(false);
  const [showRightScrollArrow, setShowRightScrollArrow] = useState(false);
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  const subTabs = tabSpec.subTabs;
  const tabState = navTabSpec && ui.tabs.get(navTabSpec?.tab);
  const _subTabIndex = subTabs.findIndex((subTab) => tabState?.openSubTab === subTab.label);
  const subTabIndex = _subTabIndex < 0 ? 0 : _subTabIndex;
  const selectedSubTab = subTabs[subTabIndex];

  useEffect(() => {
    // Set the initial open tab. If the tabSpec changes somehow then the open
    // sub tab will get reset
    ui.setOpenSubTab(tabSpec.tab, subTabs[0].label);
  }, [subTabs, tabSpec.tab, ui]);

  // This is called even if the tab is already open
  const handleTabSelect = (tabidx: number) => {
    const selectedSubTab = subTabs[tabidx];
    const subTabType = selectedSubTab.sections[0].type;
    const title = selectedSubTab.label;
    if (tabState?.openSubTab === title && tabState?.openDocuments.get(title)) {
      // If there is a document open then a click on the tab should close
      // the document
      ui.closeSubTabDocument(tabSpec.tab, title);
    }
    ui.setOpenSubTab(tabSpec.tab, title);
    Logger.log(LogEventName.SHOW_TAB_SECTION, {
      tab_section_name: title,
      // FIXME: this can be inaccurate, there can be multiple
      // section types in a sub tab, this is just going to be
      // the type of the first section
      tab_section_type: subTabType
    });
  };

  const handleSelectDocument = (document: DocumentModelType) => {
    if (!document.hasContent && document.isRemote) {
      loadDocumentContent(document);
    }
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

  const renderDocumentBrowserView = (subTab: ISubTabSpec) => {
    const openDocumentKey = tabState?.openDocuments.get(subTab.label);
    const classHash = classStore.classHash;
    return (
      <div>
        <DocumentCollectionList
          subTab={subTab}
          tabSpec={tabSpec}
          selectedDocument={openDocumentKey}
          onSelectDocument={handleSelectDocument}
        />
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

    const handleCollapseScroller = () => {
      setScrollerCollapsed(!scrollerCollapsed);
    };
    return (
      <div className="scroller-and-document">
        { selectedSubTab.label === "Starred" &&
          <>
            <div className={classNames("scroller", {"collapsed": scrollerCollapsed})} ref={documentScrollerRef}>
              <div className={classNames("scroller-controls", "left", {"collapsed": scrollerCollapsed})}>
                <div className="scroller-controls-overlay left"/>
                <div className={classNames("scroll-arrow-button", "themed", tabSpec.tab,
                                            {"collapsed": scrollerCollapsed}, {"show": showLeftScrollArrow})}>
                  <ScrollArrowIcon className={`scroll-arrow left themed ${tabSpec.tab}`} />
                </div>
              </div>
              <DocumentCollectionList
                  subTab={subTab}
                  tabSpec={tabSpec}
                  horizontal={true}
                  collapsed={scrollerCollapsed}
                  selectedDocument={openDocumentKey}
                  onSelectDocument={handleSelectDocument}
              />
              <div className={classNames("scroller-controls", "right", {"collapsed": scrollerCollapsed})}>
                <div className="scroller-controls-overlay right"/>
                <div className={classNames("scroll-arrow-button", "themed", tabSpec.tab,
                                            {"collapsed": scrollerCollapsed}, {"show": showRightScrollArrow})}>
                  <ScrollArrowIcon className={`scroll-arrow-icon right themed ${tabSpec.tab}`} />
                </div>
              </div>
            </div>
            <div className={classNames("collapse-scroller-button", "themed", tabSpec.tab,
                    {"collapsed": scrollerCollapsed})} onClick={handleCollapseScroller}>
              <CollapseScrollerIcon className={`scroller-icon ${tabSpec.tab}`}/>
            </div>
          </>

        }
        <div className="document-area">
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

      </div>
    );
  };

  return (
    <SubTabsPanel
      tabSpec={tabSpec}
      tabsExtraClassNames={{"chat-open": isChatOpen}}
      onSelect={handleTabSelect}
      selectedIndex={subTabIndex}
      renderSubTabPanel={subTab =>
        renderDocumentView(subTab) || renderDocumentBrowserView(subTab)
      }
    />
  );
});
