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

import "./section-document-or-browser.scss";

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
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  const subTabs = tabSpec.subTabs;
  const tabState = navTabSpec && ui.tabs.get(navTabSpec?.tab);
  const subTabIndex = Math.max(subTabs.findIndex((subTab) => tabState?.openSubTab === subTab.label), 0);
  const selectedSubTab = subTabs[subTabIndex];

  useEffect(() => {
    // Set the initial open tab. If the tabSpec changes somehow then the open
    // sub tab will get reset
    ui.setOpenSubTab(tabSpec.tab, subTabs[0].label);
  }, [subTabs, tabSpec.tab, ui]);

  // This is called even if the tab is already open
  const handleTabSelect = (tabidx: number) => {
    const _selectedSubTab = subTabs[tabidx];
    const subTabType = _selectedSubTab.sections[0].type;
    const title = _selectedSubTab.label;
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

  //TODO: Need to refactor this if we want to deploy to all tabs
  const renderDocumentView = (subTab: ISubTabSpec) => {
    const openDocumentKey = tabState?.openDocuments.get(subTab.label) || "";
    const openDocument = store.documents.getDocument(openDocumentKey) ||
      store.networkDocuments.getDocument(openDocumentKey);
    const publishedDoc = openDocument?.type === "publication" || openDocument?.type === "personalPublication"
                          || openDocument?.type === "learningLogPublication";
    const showPlayback = user.type && !publishedDoc ? appConfigStore.enableHistoryRoles.includes(user.type) : false;
    const isStarredTab = selectedSubTab.label === "Starred";
    const skipDocument = !openDocument || openDocument.getProperty("isDeleted");
    const sectionClass = openDocument?.type === "learningLog" ? "learning-log" : "";

    if (!isStarredTab && skipDocument) return false;

    return (
      <div className="scroller-and-document">
        { isStarredTab &&
            <DocumentBrowserScroller subTab={subTab} tabSpec={tabSpec} openDocumentKey={openDocumentKey}
                onSelectDocument={handleSelectDocument} />
        }
        {skipDocument
        ? null
        : <div className="document-area">
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
        }
      </div>
    );
  };

  return (
    <SubTabsPanel
      tabSpec={tabSpec}
      tabsExtraClassNames={{"chat-open": isChatOpen}}
      onSelect={handleTabSelect}
      selectedIndex={subTabIndex}
      renderSubTabPanel={subTab => renderDocumentView(subTab) || renderDocumentBrowserView(subTab)}
    />
  );
});

interface DocumentBrowserScrollerProps {
  subTab: ISubTabSpec;
  tabSpec: NavTabModelType;
  openDocumentKey: string;
  onSelectDocument: (document: DocumentModelType) => void;
}
const DocumentBrowserScroller =
    ({subTab, tabSpec, openDocumentKey, onSelectDocument}: DocumentBrowserScrollerProps) => {
  const [scrollerCollapsed, setScrollerCollapsed] = useState(false);
  const [collectionElement, setCollectionElement] = useState<HTMLDivElement>();
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [scrollToLocation, setScrollToLocation] = useState(0);
  const [panelWidth, setPanelWidth] = useState(0);

  const scrollWidth = collectionElement?.scrollWidth ?? 0;
  const maxScrollTo = scrollWidth - panelWidth;

  useEffect(() => {
    if(scrollToLocation !== undefined) {
      collectionElement?.scrollTo({left: scrollToLocation, behavior: "smooth"});
    }
  },[collectionElement, scrollToLocation]);

  // Keep track of the size of the containing element
  useEffect(() => {
    let obs: ResizeObserver;
    if (documentScrollerRef.current) {
      obs = new ResizeObserver(() => {
        setPanelWidth(documentScrollerRef.current?.clientWidth ?? 0);
      });
      obs.observe(documentScrollerRef.current);
    }

    return () => obs?.disconnect();
  }, []);

  const handleScrollTo = (side: string) => {
    const direction = side ==="left" ? -1 : 1;
    const attemptedScrollTo = scrollToLocation + direction * panelWidth;
    const scrollTo = Math.max(0, Math.min(maxScrollTo, attemptedScrollTo));
    setScrollToLocation(scrollTo);
  };

  const handleCollapseScroller = () => {
    setScrollerCollapsed(!scrollerCollapsed);
  };

  return (
    <>
      <div className={classNames("scroller", {"collapsed": scrollerCollapsed})} ref={documentScrollerRef}>
        {(scrollToLocation > 0) &&
            <ScrollEndControl side={"left"} collapsed={scrollerCollapsed} tab={tabSpec.tab}
                onScroll={handleScrollTo} />
        }
        <DocumentCollectionList
            setCollectionElement={setCollectionElement}
            subTab={subTab}
            tabSpec={tabSpec}
            horizontal={true}
            collapsed={scrollerCollapsed}
            selectedDocument={openDocumentKey}
            scrollToLocation={scrollToLocation}
            onSelectDocument={onSelectDocument}
        />
        {(scrollToLocation < maxScrollTo) &&
            <ScrollEndControl side={"right"} collapsed={scrollerCollapsed} tab={tabSpec.tab}
                onScroll={handleScrollTo} />
        }
      </div>
      <div className={classNames("collapse-scroller-button", "themed", tabSpec.tab,
                {"collapsed": scrollerCollapsed})} onClick={handleCollapseScroller}>
        <CollapseScrollerIcon className={`scroller-icon ${tabSpec.tab}`}/>
      </div>
    </>
  );
};

interface IScrollEndControlProps {
  side: string;
  collapsed: boolean;
  tab: string;
  onScroll: (side: string) => void
}

const ScrollEndControl = ({side, collapsed, tab, onScroll}: IScrollEndControlProps) => {
  return (
    <div className={classNames("scroller-controls", side, {collapsed})}>
      <div className={`scroller-controls-overlay ${side}`}/>
      <div className={classNames("scroll-arrow-button", "themed", tab, {collapsed})}
            onClick={()=>onScroll(side)}>
        <ScrollArrowIcon className={`scroll-arrow-icon ${side} themed ${tab}`} />
      </div>
    </div>
  );
};
