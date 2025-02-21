import React, { useEffect } from "react";
import { observer } from "mobx-react";
import { useQueryClient } from 'react-query';
import { DocumentModelType } from "../../models/document/document";
import { logDocumentViewEvent } from "../../models/document/log-document-event";
import { ISubTabModel, NavTabModelType, kBookmarksTabTitle } from "../../models/view/nav-tabs";
import { useAppConfig, useClassStore, useProblemStore, useStores,
         useUserStore, usePersistentUIStore } from "../../hooks/use-stores";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { useUserContext } from "../../hooks/use-user-context";
import { NetworkDocumentsSection } from "./network-documents-section";
import { DocumentCollectionList, kNavItemScale } from "../thumbnail/document-collection-list";
import { SubTabsPanel } from "./sub-tabs-panel";
import { DocumentView } from "./document-view";

import "./section-document-or-browser.scss";

interface IProps {
  tabSpec: NavTabModelType;
  isChatOpen?: boolean;
}

export const SectionDocumentOrBrowser: React.FC<IProps> = observer(function SectionDocumentOrBrowser(
    { tabSpec, isChatOpen }) {
  const persistentUI = usePersistentUIStore();
  const store = useStores();
  const appConfigStore = useAppConfig();
  const problemStore = useProblemStore();
  const context = useUserContext();
  const queryClient = useQueryClient();
  const user = useUserStore();
  const classStore = useClassStore();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  const subTabs = tabSpec.subTabs;
  const maybeTabState = navTabSpec && persistentUI.tabs.get(navTabSpec?.tab);
  const subTabIndex = Math.max(
    subTabs.findIndex((subTab) => maybeTabState?.currentDocumentGroupId === subTab.label),
    0
  );
  const selectedSubTab = subTabs[subTabIndex];

  useEffect(() => {
    // Set the default open subTab if a subTab isn't already set.
    if (!persistentUI.tabs.get(tabSpec.tab)?.currentDocumentGroupId) {
      persistentUI.setCurrentDocumentGroupId(tabSpec.tab, subTabs[0].label);
    }
  }, [subTabs, tabSpec.tab, persistentUI]);

  // This is called even if the tab is already open
  const handleTabSelect = (tabidx: number) => {
    const _selectedSubTab = subTabs[tabidx];
    const subTabType = _selectedSubTab.sections[0].type;
    const title = _selectedSubTab.label;
    if (maybeTabState?.currentDocumentGroupId === title && maybeTabState?.currentDocumentGroup?.primaryDocumentKey) {
      // If there is a document open then a click on the tab should close
      // the document
      maybeTabState.getDocumentGroup(title)?.closePrimaryDocument();
    }
    persistentUI.setCurrentDocumentGroupId(tabSpec.tab, title);
    Logger.log(LogEventName.SHOW_TAB_SECTION, {
      tab_section_name: title,
      // FIXME: this can be inaccurate, there can be multiple
      // section types in a sub tab, this is just going to be
      // the type of the first section
      tab_section_type: subTabType
    });
  };

  const handleSelectDocument = (document: DocumentModelType) => {
    if (persistentUI.focusDocument === document.key) {
      persistentUI.closeDocumentGroupPrimaryDocument(tabSpec.tab, selectedSubTab.label);
    } else {
      if (!document.hasContent && document.isRemote) {
        loadDocumentContent(document);
      }
      persistentUI.openSubTabDocument(tabSpec.tab, selectedSubTab.label, document.key);
      logDocumentViewEvent(document);
    }
  };

  const loadDocumentContent = async (document: DocumentModelType) => {
    await document.fetchRemoteContent(queryClient, context);
  };

  const renderDocumentBrowserView = (subTab: ISubTabModel) => {
    const openDocumentKey = maybeTabState?.getDocumentGroup(subTab.label)?.primaryDocumentKey;
    const classHash = classStore.classHash;
    return (
      <div className="document-browser vertical">
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

  const renderDocumentView = (subTab: ISubTabModel) => {
    const documentGroup = maybeTabState?.getDocumentGroup(subTab.label);
    const openDocumentKey = documentGroup?.primaryDocumentKey || "";
    const openDocument = store.documents.getDocument(openDocumentKey) ||
                            store.networkDocuments.getDocument(openDocumentKey);
    const openFirstDoc = subTab.sections.length > 0 && subTab.sections[0].openFirstDocumentAutomatically;
    const isStarredTab = subTab.label === kBookmarksTabTitle;
    if (
      // The Bookmarks tab always shows the DocumentView
      isStarredTab ||
      // If there is an explicitly opened document then we show the DocumentView
      (openDocument && !openDocument.getProperty("isDeleted")) ||
      // If the user has not explicitly closed a document then we show the Document view
      (openFirstDoc && !documentGroup?.userExplicitlyClosedDocument)
    ) {
      return (
        <DocumentView tabSpec={tabSpec} subTab={subTab} />
      );
    }
    // Otherwise render the document browser
    return false;
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
