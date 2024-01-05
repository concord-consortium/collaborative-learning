import React from "react";
import classNames from "classnames";
import { useAppConfig, useProblemStore,
  usePersistentUIStore, useUserStore, useClassStore, useUIStore, useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { EditableDocumentContent } from "./editable-document-content";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import EditIcon from "../../clue/assets/icons/edit-right-icon.svg";
import { observer } from "mobx-react";
import { tabName } from "./sort-work-view";


export const SortWorkDocumentArea: React.FC = observer(function SortWorkDocumentArea() {
  const store = useStores();
  const ui = useUIStore();
  const persistentUI = usePersistentUIStore();
  const user = useUserStore();
  const classStore = useClassStore();
  const problemStore = useProblemStore();
  const appConfigStore = useAppConfig();

  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabName);
  const tabState = navTabSpec && persistentUI.tabs.get(navTabSpec?.tab);
  const openDocumentKey = tabState?.openDocuments.get(tabName) || "";
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

  const editButton = (type: string, sClass: {secondary: boolean | undefined; primary: boolean | undefined} | string,
                      document: DocumentModelType) => {
    const showEditButton = document.uid === user.id; //only show if doc is owned by the user who opened it
    return (
      showEditButton ?
      <div
        className={classNames("edit-button", sClass)}
        onClick={() => handleEditClick(document)}
      >
        <EditIcon className={`edit-icon ${sClass}`} />
        <div>Edit</div>
      </div>
      :
      null
    );
  };

  const sideClasses = { secondary: false, primary: false && !false };

  return (
    <div className={classNames("focus-document", tabName, sideClasses)}>
      <div className={classNames("document-header", tabName, sectionClass, sideClasses)}
            onClick={() => ui.setSelectedTile()}>
        <div className="document-title">
          {(displayTitle && displayTitle.owner)
              && <span className="document-owner">{displayTitle.owner}: </span>}
          <span className={classNames("document-title")}>
            {displayTitle && displayTitle.title}
          </span>
        </div>
        {
          openDocument && editButton(tabName, sectionClass || sideClasses, openDocument)
        }
      </div>
     {
        openDocument &&
        <EditableDocumentContent
          mode={"1-up"}
          isPrimary={false}
          document={openDocument}
          readOnly={true}
          showPlayback={showPlayback}
          fullHeight={true}
        />
     }
    </div>
  );
});
