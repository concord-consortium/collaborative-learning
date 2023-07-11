import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { observer } from "mobx-react";
import { useQueryClient } from "react-query";
import classNames from "classnames";
import { useAppConfig, useClassStore, useLocalDocuments, useProblemStore,
   useStores, useUIStore, useUserStore } from "../../hooks/use-stores";
import { useUserContext } from "../../hooks/use-user-context";
import { ISubTabSpec, NavTabModelType } from "src/models/view/nav-tabs";
import { DocumentType } from "../../models/document/document-types";
import { LogEventName } from "../../lib/logger-types";
import { logDocumentEvent } from "../../models/document/log-document-event";
import { DocumentModelType } from "../../models/document/document";
import { EditableDocumentContent } from "../document/editable-document-content";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import { DocumentCollectionList } from "../thumbnail/document-collection-list";
import CollapseScrollerIcon from "../../assets/show-hide-document-view-icon.svg";
import ScrollArrowIcon from "../../assets/scroll-arrow-icon.svg";
import EditIcon from "../../clue/assets/icons/edit-right-icon.svg";

interface IProps {
  tabSpec: NavTabModelType;
  subTab: ISubTabSpec;
}
//TODO: Need to refactor this if we want to deploy to all tabs
export const DocumentView = observer(function DocumentView({tabSpec, subTab}: IProps) {
  const ui = useUIStore();
  const store = useStores();
  const appConfigStore = useAppConfig();
  const problemStore = useProblemStore();
  const context = useUserContext();
  const queryClient = useQueryClient();
  const user = useUserStore();
  const classStore = useClassStore();
  const documents = useLocalDocuments();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  const tabState = navTabSpec && ui.tabs.get(navTabSpec?.tab);
  const openDocumentKey = tabState?.openDocuments.get(subTab.label) || "";
  const openDocument = store.documents.getDocument(openDocumentKey) ||
    store.networkDocuments.getDocument(openDocumentKey);
  const openSecondaryDocumentKey = tabState?.openSecondaryDocuments.get(subTab.label) || "";
  const openSecondaryDocument = store.documents.getDocument(openSecondaryDocumentKey) ||
    store.networkDocuments.getDocument(openSecondaryDocumentKey);
  const showPlayback = user.type && !openDocument?.isPublished
                          ? appConfigStore.enableHistoryRoles.includes(user.type) : false;
  const isStarredTab = subTab.label === "Starred";
  const skipDocument = !openDocument || openDocument.getProperty("isDeleted");

  const documentTypes: DocumentType[] = tabSpec.tab === "class-work"
                                          ? ["publication"]
                                          : tabSpec.tab === "my-work" && subTab.label === "Starred"
                                            ? ["problem", "personal"]
                                            : [];
  const getStarredDocuments = (types: DocumentType[]) => {
    const docs: DocumentModelType[] = [];
      types.forEach((type) => {
        const docsByTypeArr = documents.byType(type);
        docsByTypeArr.forEach((doc: any) => {
          docs.push(doc);
        });
      });
    const starredDocs = docs.filter((doc: DocumentModelType) => !doc.getProperty("isDeleted") && doc.isStarred);
    return starredDocs;
  };
  const starredDocuments = getStarredDocuments(documentTypes);
  const numStarredDocs = starredDocuments.length;
  const currentOpenDocIndex = openDocument && starredDocuments.indexOf(openDocument);
  const currentOpenSecondaryDocIndex = openSecondaryDocument && starredDocuments.indexOf(openSecondaryDocument);
  const sectionClass = openDocument?.type === "learningLog" ? "learning-log" : "";

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

  const loadDocumentContent = async (document: DocumentModelType) => {
    await document.fetchRemoteContent(queryClient, context);
  };

  const handleSelectDocument = (document: DocumentModelType) => {
    // If the currently open primary document is clicked on, and there is an open secondary document,
    // we make the secondary document primary, and close the secondary document.
    // If there is a primary and secondary document open, and the user clicks on a third document,
    // we close the secondary document, a make the open the third document as the secondary document.
    if (ui.focusDocument === document.key) {
      if (ui.focusSecondaryDocument) {
        ui.openSubTabDocument(tabSpec.tab, subTab.label, ui.focusSecondaryDocument);
        ui.closeSubTabSecondaryDocument(tabSpec.tab, subTab.label);
      } else {
        ui.closeSubTabDocument(tabSpec.tab, subTab.label);
      }
    } else if (tabState?.openDocuments.get("Starred")) {
      if (ui.focusSecondaryDocument === document.key) {
        ui.closeSubTabSecondaryDocument(tabSpec.tab, "Starred");
      } else {
        ui.openSubTabSecondaryDocument(tabSpec.tab, "Starred", document.key);
      }
    } else {
      if (!document.hasContent && document.isRemote) {
        loadDocumentContent(document);
      }
      ui.openSubTabDocument(tabSpec.tab, subTab.label, document.key);
      const logEvent = document.isRemote
        ? LogEventName.VIEW_SHOW_TEACHER_NETWORK_COMPARISON_DOCUMENT
        : LogEventName.VIEW_SHOW_COMPARISON_DOCUMENT;
      logDocumentEvent(logEvent, { document });
    }
  };

  // Published documents are listed in reverse order of index [n..1] so previous and next toggles are also reversed
  // Workspaces Starred tab show the problem document as the first document in the list
  // and personal documents are shown in reverse order. So when we get the list of starred
  // documents, the sequence is [0] is the problem document [1..n] are the personal documents.
  // But when displayed, the sequence is [0, n..1].
  // So we still want to display the previous arrow when we reach n to flip to the problem
  // document.
  const handleChangeDocument = (shift: number, secondary?: boolean) => {
    const currentIndex = secondary ? currentOpenSecondaryDocIndex : currentOpenDocIndex;
    if (currentIndex !== undefined) {
      const getNewDocIndex = () => {
        let tempNewDocIndex = (((currentIndex + shift) % numStarredDocs) + numStarredDocs) % numStarredDocs;
        const currentIndexIsOpen = tempNewDocIndex === currentOpenDocIndex
                                    || tempNewDocIndex === currentOpenSecondaryDocIndex;
        if (currentIndexIsOpen) {
          tempNewDocIndex = (currentIndex + (2 * shift)) % numStarredDocs;
        }
        return tempNewDocIndex;
      };
      const newDocIndex = getNewDocIndex();
      const newDocKey = starredDocuments.at(newDocIndex)?.key;

      if (secondary) {
        newDocKey && ui.openSubTabSecondaryDocument(tabSpec.tab, subTab.label, newDocKey);
      } else {
        newDocKey && ui.openSubTabDocument(tabSpec.tab, subTab.label, newDocKey);
      }
    }
  };

  const hideLeftFlipper = (position?: string) => {
    const primaryDocIndex = position === "secondary" ? currentOpenSecondaryDocIndex : currentOpenDocIndex;
    const secondaryDocIndex = position === "secondary" ? currentOpenDocIndex : currentOpenSecondaryDocIndex;
    if (tabSpec.tab === "class-work") {
      return (primaryDocIndex === numStarredDocs - 1
                || (secondaryDocIndex === numStarredDocs - 1 && primaryDocIndex === numStarredDocs - 2));
    }
    if (tabSpec.tab === "my-work") {
      return (primaryDocIndex === 0
                || (secondaryDocIndex === 0 && primaryDocIndex === numStarredDocs - 1));
    }
  };

  const hideRightFlipper = (position?: string) => {
    const primaryDocIndex = position === "secondary" ? currentOpenSecondaryDocIndex : currentOpenDocIndex;
    const secondaryDocIndex = position === "secondary" ? currentOpenDocIndex : currentOpenSecondaryDocIndex;
    if (tabSpec.tab === "class-work") {
      return (primaryDocIndex === 0 || (secondaryDocIndex === 0 && primaryDocIndex === 1));
    }
    if (tabSpec.tab === "my-work") {
      return (primaryDocIndex === 1 || (secondaryDocIndex === 1 && primaryDocIndex === 2));
    }
  };

  const getDisplayTitle = (document: DocumentModelType) => {
    const documentOwner = classStore.users.get(document.uid);
    const documentTitle = getDocumentDisplayTitle(document, appConfigStore, problemStore);
    return openSecondaryDocument && documentOwner ? documentOwner.fullName + " " + documentTitle : documentTitle;
  };

  return (
    <div className="scroller-and-document">
      { isStarredTab &&
        <DocumentBrowserScroller subTab={subTab} tabSpec={tabSpec} openDocumentKey={openDocumentKey}
            openSecondaryDocumentKey={openSecondaryDocumentKey} onSelectDocument={handleSelectDocument} />
      }
      {skipDocument
        ? null
        : <div className="document-area">
            <div className={`focus-document ${openSecondaryDocument ? "primary" : ""}`}>
              <div className={`document-header ${tabSpec.tab} ${sectionClass}
                              ${openSecondaryDocument ? "primary" : ""}`} onClick={() => ui.setSelectedTile()}>
                <div className={`document-title`}>
                  {getDisplayTitle(openDocument)}
                </div>
                {(!openDocument.isRemote)
                    && editButton(tabSpec.tab, sectionClass, openDocument)}
              </div>
              <div className="scroll-arrow-button-wrapper left">
                <ScrollButton side={"left"} tab={tabSpec.tab} onScroll={() => handleChangeDocument(1)}
                    hidden={!isStarredTab || (isStarredTab && hideLeftFlipper())} />
              </div>
              <EditableDocumentContent
                mode={"1-up"}
                isPrimary={false}
                document={openDocument}
                readOnly={true}
                showPlayback={showPlayback}
              />
              <div className="scroll-arrow-button-wrapper right">
                <ScrollButton side={"right"} tab={tabSpec.tab} onScroll={() => handleChangeDocument(-1)}
                    hidden={!isStarredTab || (isStarredTab && hideRightFlipper())}/>
              </div>
            </div>
            {(!openSecondaryDocument || openSecondaryDocument.getProperty("isDeleted"))
              ? null
              : <div className={`focus-document secondary ${tabSpec.tab}`}>
                  <div className={`document-header ${tabSpec.tab} ${sectionClass} secondary`}
                        onClick={() => ui.setSelectedTile()}>
                    <div className={`document-title`}>
                      {getDisplayTitle(openSecondaryDocument)}
                    </div>
                    {(!openSecondaryDocument.isRemote)
                        && editButton(tabSpec.tab, sectionClass, openSecondaryDocument)}
                  </div>
            <div className="scroll-arrow-button-wrapper left">
              <ScrollButton side={"left"} tab={tabSpec.tab} onScroll={() => handleChangeDocument(1, true)}
                  hidden={!isStarredTab || (isStarredTab && hideLeftFlipper("secondary"))} />
            </div>
                  <EditableDocumentContent
                    mode={"1-up"}
                    isPrimary={false}
                    document={openSecondaryDocument}
                    readOnly={true}
                    showPlayback={showPlayback}
                  />
            <div className="scroll-arrow-button-wrapper right">
              <ScrollButton side={"right"} tab={tabSpec.tab} onScroll={() => handleChangeDocument(-1, true)}
                  hidden={!isStarredTab || (isStarredTab && hideRightFlipper("secondary"))}/>
            </div>
                </div>
            }
          </div>
      }
    </div>
  );
});

interface DocumentBrowserScrollerProps {
  subTab: ISubTabSpec;
  tabSpec: NavTabModelType;
  openDocumentKey: string;
  openSecondaryDocumentKey: string;
  onSelectDocument: (document: DocumentModelType) => void;
}

const DocumentBrowserScroller =
    ({subTab, tabSpec, openDocumentKey, openSecondaryDocumentKey, onSelectDocument}: DocumentBrowserScrollerProps) => {
  const [scrollerCollapsed, setScrollerCollapsed] = useState(false);
  const [collectionElement, setCollectionElement] = useState<HTMLDivElement>();
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [scrollToLocation, setScrollToLocation] = useState(0);
  const [panelWidth, setPanelWidth] = useState(0);

  const scrollWidth = collectionElement?.scrollWidth ?? 0;

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
    const scrollTo = Math.max(0, Math.min(scrollWidth - panelWidth, attemptedScrollTo));
    setScrollToLocation(scrollTo);
  };

  const handleCollapseScroller = () => {
    setScrollerCollapsed(!scrollerCollapsed);
  };

  return (
    <>
      <div className={classNames("scroller", tabSpec.tab, {"collapsed": scrollerCollapsed})} ref={documentScrollerRef}>
        {(scrollToLocation > 0) &&
            <ScrollEndControl side={"left"} hidden={scrollerCollapsed} tab={tabSpec.tab}
                onScroll={handleScrollTo} />
        }
        <DocumentCollectionList
            setCollectionElement={setCollectionElement}
            subTab={subTab}
            tabSpec={tabSpec}
            horizontal={true}
            collapsed={scrollerCollapsed}
            selectedDocument={openDocumentKey}
            selectedSecondaryDocument={openSecondaryDocumentKey}
            scrollToLocation={scrollToLocation}
            onSelectDocument={onSelectDocument}
        />
        {(scrollToLocation < scrollWidth - panelWidth) &&
            <ScrollEndControl side={"right"} hidden={scrollerCollapsed} tab={tabSpec.tab}
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
  hidden?: boolean;
  tab: string;
  onScroll: (side: string) => void
}

const ScrollEndControl = ({side, hidden, tab, onScroll}: IScrollEndControlProps) => {
  if (hidden) return null;
  return (
    <div className={classNames("scroller-controls", side)}>
      <div className={`scroller-controls-overlay ${side}`}/>
      <ScrollButton side={side} tab={tab} onScroll={onScroll} hidden={hidden}/>
    </div>
  );
};

const ScrollButton = ({side, hidden, tab, onScroll}: IScrollEndControlProps) => {
  if (hidden) return null;
  return (
    <div className={classNames("scroll-arrow-button", "themed", tab, side)}
          onClick={()=>onScroll(side)}>
      <ScrollArrowIcon className={`scroll-arrow-icon ${side} themed ${tab}`} />
    </div>
  );
};
