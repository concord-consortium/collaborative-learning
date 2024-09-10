import React, { useEffect, useState } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { useAppConfig, useProblemStore,
  usePersistentUIStore, useUserStore, useClassStore, useUIStore, useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { EditableDocumentContent } from "./editable-document-content";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import { ENavTab } from "../../models/view/nav-tabs";
import { isExemplarType } from "../../models/document/document-types";
import { ExemplarVisibilityCheckbox } from "./exemplar-visibility-checkbox";
import { DocumentLoadingSpinner } from "./document-loading-spinner";

import EditIcon from "../../clue/assets/icons/edit-right-icon.svg";
import CloseIcon from "../../../src/assets/icons/close/close.svg";

interface IProps {
  openDocumentKey: string;
}

export const SortWorkDocumentArea: React.FC<IProps> = observer(function SortWorkDocumentArea({openDocumentKey}) {
  const store = useStores();
  const ui = useUIStore();
  const persistentUI = usePersistentUIStore();
  const user = useUserStore();
  const classStore = useClassStore();
  const problemStore = useProblemStore();
  const appConfigStore = useAppConfig();
  const [openDocument, setOpenDocument] = useState<DocumentModelType|undefined>();
  const isVisible = openDocument?.isAccessibleToUser(user, store.documents);
  const showPlayback = user.type && appConfigStore.enableHistoryRoles.includes(user.type);
  const showExemplarShare = user.type === "teacher" && openDocument && isExemplarType(openDocument.type);
  const getDisplayTitle = (document: DocumentModelType) => {
    const documentOwner = classStore.users.get(document.uid);
    const documentTitle = getDocumentDisplayTitle(document, appConfigStore, problemStore, store.unit.code);
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

  const handleCloseButtonClick = () => {
    persistentUI.closeSubTabDocument();
  };

  const sideClasses = { secondary: false, primary: false && !false };

  useEffect(() => {
    const openDoc = store.documents.getDocument(openDocumentKey) ||
                       store.networkDocuments.getDocument(openDocumentKey);
    if (openDoc) {
      setOpenDocument(openDoc);
      return;
    }

    const fetchOpenDoc = store.sortedDocuments.fetchFullDocument(openDocumentKey);
    fetchOpenDoc.then((doc) => {
      setOpenDocument(doc);
    });

    // TODO: Figure out how to cancel fetch if the component is unmounted before the fetch is complete

  }, [openDocumentKey, store.documents, store.networkDocuments, store.sortedDocuments]);

  return (
    <div className={classNames("focus-document", ENavTab.kSortWork, sideClasses)}>
      <div className={classNames("document-header", ENavTab.kSortWork, sectionClass, sideClasses)}
            onClick={() => ui.setSelectedTile()}>
        {showExemplarShare && <ExemplarVisibilityCheckbox document={openDocument} />}
        <div className="document-title">
          {(displayTitle && displayTitle.owner)
              && <span className="document-owner">{displayTitle.owner}: </span>}
          <span className={classNames("document-title")}>
            {displayTitle && displayTitle.title}
          </span>
        </div>
        <div className="document-buttons">
          { openDocument &&
            editButton(ENavTab.kSortWork, sectionClass || sideClasses, openDocument)
          }
          <button className="close-doc-button" onClick={handleCloseButtonClick}>
            <CloseIcon />
          </button>
        </div>
      </div>
     {
        openDocument && isVisible &&
        <EditableDocumentContent
          mode={"1-up"}
          isPrimary={false}
          document={openDocument}
          readOnly={true}
          showPlayback={showPlayback}
          fullHeight={true}
        />
     }
     {
        openDocument && !isVisible &&
        <div className="document-error">
          <p>This document is not shared with you right now.</p>
        </div>
     }
     {
        !openDocument &&
        <DocumentLoadingSpinner/>
     }
    </div>
  );
});
