import React from "react";
import classNames from "classnames";
import { useAppConfig, useProblemStore,
  usePersistentUIStore, useUserStore, useClassStore, useUIStore, useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { EditableDocumentContent } from "./editable-document-content";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import EditIcon from "../../clue/assets/icons/edit-right-icon.svg";
import { NavTabModelType } from "../../models/view/nav-tabs";
import { observer } from "mobx-react";


interface ISortWorkDocumentArea {
  // tabSpec: NavTabModelType;
  // openDocument: DocumentModelType;
  // subTab: ISubTabSpec;
  tab: string;
  tabSpec: NavTabModelType;

  // sectionClass: string;
  isSecondaryDocument?: boolean;
  hasSecondaryDocument?: boolean;
  hideLeftFlipper?: boolean;
  hideRightFlipper?: boolean;
  onChangeDocument?: (shift: number, secondary?: boolean) => void;
}

export const SortWorkDocumentArea: React.FC<ISortWorkDocumentArea> = observer(function SortWorkDocumentArea({
                       tabSpec,
                       tab,
                      }: ISortWorkDocumentArea){
  const store = useStores();
  const ui = useUIStore();
  const persistentUI = usePersistentUIStore();
  const user = useUserStore();
  const classStore = useClassStore();
  const problemStore = useProblemStore();
  const appConfigStore = useAppConfig();

  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  const tabState = navTabSpec && persistentUI.tabs.get(navTabSpec?.tab);
  const openDocumentKey = tabState?.openDocuments.get("sort-work") || "";
  const openDocument = store.documents.getDocument(openDocumentKey) ||
                       store.networkDocuments.getDocument(openDocumentKey);

  const showPlayback = user.type && !openDocument?.isPublished
                          ? appConfigStore.enableHistoryRoles.includes(user.type) : false;
  const getDisplayTitle = (document: DocumentModelType) => {
    const documentOwner = classStore.users.get(document.uid);
    const documentTitle = getDocumentDisplayTitle(document, appConfigStore, problemStore);
    return {owner: documentOwner ? documentOwner.fullName : "", title: documentTitle};
  };

  const displayTitle = openDocument && getDisplayTitle(openDocument);

  function handleEditClick(document: DocumentModelType) {
    persistentUI.problemWorkspace.setPrimaryDocument(document);
  }

  const sectionClass = openDocument?.type === "learningLog" ? "learning-log" : "";

  // TODO: this edit button is confusing when the history is being viewed. It
  // opens the original document for editing, not some old version of the
  // document they might be looking at. Previously this edit button was disabled
  // when the history document was being shown because SectionDocumentOrBrowser
  // knew the state of playback controls. It no longer knows that state, so now
  // the edit button is shown all of the time.
  // PT Story: https://www.pivotaltracker.com/story/show/183416176


  const editButton = (type: string, sClass: {secondary: boolean | undefined; primary: boolean | undefined} | string,
                      document: DocumentModelType) => {

    //TODO: keep this editButton component, if owner is me then render the button
    return (
      (type === "my-work") || (type === "learningLog")
        ?
          <div className={classNames("edit-button", sClass)}
                onClick={() => handleEditClick(document)}>
            <EditIcon className={`edit-icon ${sClass}`} />
            <div>Edit</div>
          </div>
        : null
    );
  };

  const sideClasses = { secondary: false, primary: false && !false };

  // console.log("📁 sort-work-document-area.tsx ------------------------");
  // console.log("\t🥩 sideClasses:", sideClasses);
  return (
    <div className={classNames("focus-document", tab, sideClasses)}>
      <div className={classNames("document-header", tab, sectionClass, sideClasses)}
            onClick={() => ui.setSelectedTile()}>
        <div className="document-title">
          {(displayTitle && displayTitle.owner && tab === "class-work")
              && <span className="document-owner">{displayTitle.owner}: </span>}
          <span className={classNames("document-title", {"class-work": tab === "class-work"})}>
            {displayTitle && displayTitle.title}
          </span>
        </div>
        {(openDocument && !openDocument.isRemote)
            && editButton(tab, sectionClass || sideClasses, openDocument)}
      </div>
     {
      openDocument &&
      <EditableDocumentContent
        mode={"1-up"}
        isPrimary={false}
        document={openDocument}
        readOnly={true}
        showPlayback={showPlayback}
        fullHeight={true} //pass true in new component
      />
     }
    </div>
  );
});
