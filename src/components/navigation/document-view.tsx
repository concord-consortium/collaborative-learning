import React from "react";
import { observer } from "mobx-react";
import { useQueryClient } from "react-query";
import classNames from "classnames";
import { useAppConfig, useLocalDocuments, useStores,
  usePersistentUIStore } from "../../hooks/use-stores";
import { useUserContext } from "../../hooks/use-user-context";
import { ISubTabModel, NavTabModelType, kBookmarksTabTitle } from "../../models/view/nav-tabs";
import { DocumentType } from "../../models/document/document-types";
import { logDocumentViewEvent } from "../../models/document/log-document-event";
import { DocumentModelType } from "../../models/document/document";
import { EditableDocumentContent } from "../document/editable-document-content";
import { SectionDocuments } from "../../models/stores/section-docs-store";
import { DocumentBrowserScroller, ScrollButton } from "./document-browser-scroller";
import CloseIcon from "../../assets/icons/close/close.svg";
import { DocumentTitle } from "../document/document-title";

interface IProps {
  tabSpec: NavTabModelType;
  subTab: ISubTabModel;
}

function getFirstDocumentKey(subTab: ISubTabModel, sectionDocuments: SectionDocuments) {
  for (const section of subTab.sections) {
    const sectionDocs = sectionDocuments.getSectionDocs(section);
    if (sectionDocs.length > 0) {
      return sectionDocs[0].key;
    }
  }
}

//TODO: Need to refactor this if we want to deploy to all tabs
export const DocumentView = observer(function DocumentView({tabSpec, subTab}: IProps) {
  const persistentUI = usePersistentUIStore();
  const store = useStores();
  const appConfigStore = useAppConfig();
  const context = useUserContext();
  const queryClient = useQueryClient();
  const documents = useLocalDocuments();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  const maybeTabState = navTabSpec && persistentUI.tabs.get(navTabSpec?.tab);
  const { sectionDocuments } = useStores();
  const openDocumentKey =
    maybeTabState?.getDocumentGroupPrimaryDocument(subTab.label) ||
    getFirstDocumentKey(subTab, sectionDocuments) ||
    "";
  const openDocument = store.documents.getDocument(openDocumentKey) ||
    store.networkDocuments.getDocument(openDocumentKey);
  const openSecondaryDocumentKey = maybeTabState?.getDocumentGroupSecondaryDocument(subTab.label) || "";
  const openSecondaryDocument = store.documents.getDocument(openSecondaryDocumentKey) ||
    store.networkDocuments.getDocument(openSecondaryDocumentKey);
  const isStarredTab = subTab.label === kBookmarksTabTitle;
  const noValidDocument = !openDocument || openDocument.getProperty("isDeleted");
  const noSecondaryDocument = !openSecondaryDocument || openSecondaryDocument.getProperty("isDeleted");

  const documentTypes: DocumentType[] = tabSpec.tab === "class-work"
                                          ? ["publication"]
                                          : tabSpec.tab === "my-work" && subTab.label === kBookmarksTabTitle
                                            ? ["problem", "personal"]
                                            : [];
  const getStarredDocuments = (types: DocumentType[]) => {
    const docs: DocumentModelType[] = [];
      types.forEach((type) => {
        const docsByTypeArr = documents.byType(type);
        if (tabSpec.tab === "my-work") {
          docsByTypeArr.forEach((doc: any) => {
            if (doc.uid === store.user.id) {
              docs.push(doc);
            }
          });
        } else {
          docsByTypeArr.forEach((doc: any) => {
            docs.push(doc);
          });
        }
      });
    const starredDocs = docs.filter((doc: DocumentModelType) =>
      !doc.getProperty("isDeleted") && store.bookmarks.isDocumentBookmarked(doc.key));
    return starredDocs;
  };
  const starredDocuments = getStarredDocuments(documentTypes);
  const numStarredDocs = starredDocuments.length;
  const currentOpenDocIndex = openDocument && starredDocuments.indexOf(openDocument);
  const currentOpenSecondaryDocIndex = openSecondaryDocument && starredDocuments.indexOf(openSecondaryDocument);
  const sectionClass = openDocument?.type === "learningLog" ? "learning-log" : "";

  const loadDocumentContent = async (document: DocumentModelType) => {
    await document.fetchRemoteContent(queryClient, context);
  };

  const handleSelectDocument = (document: DocumentModelType) => {
    // If the currently open primary document is clicked on, and there is an open secondary document,
    // we make the secondary document primary, and close the secondary document.
    // If there is a primary and secondary document open, and the user clicks on a third document,
    // we close the secondary document, and make the open the third document as the secondary document.
    if (persistentUI.focusDocument === document.key) {
      if (persistentUI.focusSecondaryDocument) {
        persistentUI.openDocumentGroupPrimaryDocument(tabSpec.tab, subTab.label, persistentUI.focusSecondaryDocument);
        persistentUI.closeDocumentGroupSecondaryDocument(tabSpec.tab, subTab.label);
      } else {
        persistentUI.closeDocumentGroupPrimaryDocument(tabSpec.tab, subTab.label);
      }
    } else if (maybeTabState?.getDocumentGroupPrimaryDocument(kBookmarksTabTitle)) {
      if (persistentUI.focusSecondaryDocument === document.key) {
        persistentUI.closeDocumentGroupSecondaryDocument(tabSpec.tab, kBookmarksTabTitle);
      } else {
        persistentUI.openDocumentGroupSecondaryDocument(tabSpec.tab, kBookmarksTabTitle, document.key);
      }
    } else {
      if (!document.hasContent && document.isRemote) {
        loadDocumentContent(document);
      }
      persistentUI.openDocumentGroupPrimaryDocument(tabSpec.tab, subTab.label, document.key);
      logDocumentViewEvent(document);
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
          tempNewDocIndex = (((currentIndex + (2 * shift)) % numStarredDocs) + numStarredDocs) % numStarredDocs;
        }
        return tempNewDocIndex;
      };
      const newDocIndex = getNewDocIndex();
      const newDocKey = starredDocuments.at(newDocIndex)?.key;

      if (secondary) {
        newDocKey && persistentUI.openDocumentGroupSecondaryDocument(tabSpec.tab, subTab.label, newDocKey);
      } else {
        newDocKey && persistentUI.openDocumentGroupPrimaryDocument(tabSpec.tab, subTab.label, newDocKey);
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
      if (numStarredDocs === 1) {
        return (primaryDocIndex === 0);
      }
      return (primaryDocIndex === 1 || (secondaryDocIndex === 1 && primaryDocIndex === 2));
    }
  };

  return (
    <div className="scroller-and-document">
      { isStarredTab &&
        <DocumentBrowserScroller subTab={subTab} tabSpec={tabSpec} openDocumentKey={openDocumentKey}
            openSecondaryDocumentKey={openSecondaryDocumentKey} onSelectDocument={handleSelectDocument} />
      }
      <div className="document-area">
        {noValidDocument
          ? null
          : <DocumentArea openDocument={openDocument} subTab={subTab} tab={tabSpec.tab}
              sectionClass={sectionClass} hasSecondaryDocument={isStarredTab && !noSecondaryDocument}
              hideLeftFlipper={!isStarredTab || hideLeftFlipper()}
              hideRightFlipper={!isStarredTab || hideRightFlipper()}
              onChangeDocument={handleChangeDocument}
            />
        }
        {noSecondaryDocument
          ? null
          : <DocumentArea openDocument={openSecondaryDocument} subTab={subTab} tab={tabSpec.tab}
              sectionClass={sectionClass} isSecondaryDocument={true} hasSecondaryDocument={true}
              hideLeftFlipper={!isStarredTab || hideLeftFlipper("secondary")}
              hideRightFlipper={!isStarredTab || hideRightFlipper("secondary")}
              onChangeDocument={handleChangeDocument}
            />
        }
      </div>
    </div>
  );
});

interface IDocumentAreaProps {
  openDocument: DocumentModelType;
  subTab: ISubTabModel;
  tab: string;
  sectionClass: string;
  isSecondaryDocument?: boolean;
  hasSecondaryDocument?: boolean;
  hideLeftFlipper?: boolean;
  hideRightFlipper?: boolean;
  onChangeDocument?: (shift: number, secondary?: boolean) => void;
}

const DocumentArea = ({openDocument, subTab, tab, sectionClass, isSecondaryDocument,
    hasSecondaryDocument, hideLeftFlipper, hideRightFlipper, onChangeDocument}: IDocumentAreaProps
) => {
  const {appConfig, persistentUI, ui, user} = useStores();
  const showPlayback = user.type && !openDocument?.isPublished
                          ? appConfig.enableHistoryRoles.includes(user.type) : false;
  const showEdit = !openDocument.isRemote && ((tab === "my-work") || (tab === "learningLog"));

  function handleCloseButtonClick() {
    persistentUI.closeDocumentGroupPrimaryDocument();
  }

  const sideClasses = { secondary: isSecondaryDocument, primary: hasSecondaryDocument && !isSecondaryDocument };

  return (
    <div className={classNames("focus-document", tab, sideClasses)}>
      <div className={classNames("document-header", tab, sectionClass, sideClasses)}
            onClick={() => ui.setSelectedTile()}>
        <DocumentTitle
          document={openDocument}
          hideOwner={tab !== "class-work"}
          extraTitleClassNames={{"class-work": tab === "class-work"}}
        />
        <div className="document-buttons">
          <button className={`close-doc-button ${tab} ${sectionClass}`} onClick={handleCloseButtonClick}>
            <CloseIcon className="close-icon" />
          </button>
        </div>
      </div>
      {onChangeDocument && !hideLeftFlipper &&
        <ScrollButton side="left" theme={tab} className="document-flipper"
            onClick={()=>onChangeDocument(1, isSecondaryDocument)}/>
      }
      <EditableDocumentContent
        mode={"1-up"}
        isPrimary={false}
        document={openDocument}
        readOnly={true}
        showPlayback={showPlayback}
        fullHeight={subTab.label !== kBookmarksTabTitle }
        toolbar={appConfig.myResourcesToolbar({showPlayback, showEdit})}
        sectionClass={sectionClass}
      />
      {onChangeDocument && !hideRightFlipper &&
        <ScrollButton side="right" theme={tab} className="document-flipper"
            onClick={()=>onChangeDocument(-1, isSecondaryDocument)}/>
      }
    </div>
  );
};
