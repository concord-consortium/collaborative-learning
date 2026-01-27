import React, { useState } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import { LogEventName } from "../../lib/logger-types";
import { isExemplarType } from "../../models/document/document-types";
import { logDocumentEvent } from "../../models/document/log-document-event";
import { DocumentGroup } from "../../models/stores/document-group";
import { ENavTab } from "../../models/view/nav-tabs";
import { DocumentLoadingSpinner } from "./document-loading-spinner";
import { DocumentScroller } from "./document-scroller";
import { EditableDocumentContent } from "./editable-document-content";
import { ExemplarVisibilityCheckbox } from "./exemplar-visibility-checkbox";
import { IOpenDocumentsGroupMetadata } from "./sorted-section";
import { DocumentTitle } from "./document-title";

import CloseIcon from "../../../src/assets/icons/close/close.svg";
import ToggleDocumentScrollerIcon from "../../../src/assets/show-hide-thumbnail-view-small-icon.svg";
import SwitchDocumentIcon from "../../assets/scroll-arrow-small-icon.svg";

interface IProps {
  nextDocumentsGroup?: DocumentGroup;
  openDocumentsGroup: DocumentGroup;
  openDocumentKey?: string;
  openGroupMetadata?: IOpenDocumentsGroupMetadata;
  previousDocumentsGroup?: DocumentGroup;
}

export const SortWorkDocumentArea: React.FC<IProps> = observer(function SortWorkDocumentArea(props: IProps) {
  const { nextDocumentsGroup, openDocumentsGroup, openDocumentKey, openGroupMetadata, previousDocumentsGroup } = props;
  const {appConfig, documents, networkDocuments,
    persistentUI, sortedDocuments, ui, user} = useStores();
  const { showDocumentScroller: showScroller, thumbnailDisplay } = persistentUI;
  const [prevBtnEnabled, setPrevBtnEnabled] = useState(openDocumentKey !== openDocumentsGroup.documents.at(0)?.key);
  const [nextBtnEnabled, setNextBtnEnabled] = useState(openDocumentKey !== openDocumentsGroup.documents.at(-1)?.key);

  if (!openDocumentKey) {
    console.warn("No open document key available, returning null.");
    return null;
  }

  const getOpenDocument = () => {
    const openDoc = documents.getDocument(openDocumentKey) ||
                      networkDocuments.getDocument(openDocumentKey);
    if (openDoc) {
      return openDoc;
    }

    // Calling `fetchFullDocument` will update the `documents` store with the full document,
    // triggering a re-render of this component since it's an observer.
    sortedDocuments.fetchFullDocument(openDocumentKey);
  };

  const openDocument = getOpenDocument();
  const isVisible = openDocument?.isAccessibleToUser(user, documents);
  const showPlayback = user.isResearcher || (user.type && appConfig.enableHistoryRoles.includes(user.type));
  const showEdit = openDocument?.uid === user.id; //only show if doc is owned by the user who opened it
  const showExemplarShare = user.type === "teacher" && openDocument && isExemplarType(openDocument.type);

  const sectionClass = openDocument?.type === "learningLog" ? "learning-log" : "";

  const handleCloseButtonClick = () => {
    if (openDocument) {
      logDocumentEvent(LogEventName.CLOSE_SORTED_DOCUMENT, { document: openDocument });
    }
    persistentUI.closeDocumentGroupPrimaryDocument();
  };

  const handleToggleScroller = () => {
    persistentUI.toggleShowDocumentScroller(!showScroller);
  };

  const handleSwitchDocument = (direction: "previous" | "next") => () => {
    const docKeys = openDocumentsGroup?.documents.map((doc) => doc.key) || [];
    const currentIndex = docKeys.indexOf(openDocumentKey);
    const newIndex = direction === "previous" ? currentIndex - 1 : currentIndex + 1;
    const newKey = docKeys[newIndex];
    if (!openGroupMetadata) {
      console.error("No openGroupMetadata found in persistentUI");
      return;
    }
    if (newKey) {
      persistentUI.openDocumentGroupPrimaryDocument(ENavTab.kSortWork, JSON.stringify(openGroupMetadata), newKey);
    }
    setPrevBtnEnabled(newIndex !== 0);
    setNextBtnEnabled(newIndex !== docKeys.length - 1);
  };

  const sideClasses = { secondary: false, primary: false && !false };

  return (
    <>
      {showScroller && (
        <DocumentScroller
          documentGroup={openDocumentsGroup}
          nextDocumentsGroup={nextDocumentsGroup}
          openDocumentKey={openDocumentKey}
          openGroupMetadata={openGroupMetadata}
          previousDocumentsGroup={previousDocumentsGroup}
        />
      )}
      {thumbnailDisplay === "Small" && (
        <div className={classNames("focus-document", ENavTab.kSortWork, sideClasses)}>
          <div className={classNames("document-header", ENavTab.kSortWork, sectionClass, sideClasses)}
                onClick={() => ui.setSelectedTile()}>
            <button
              className={classNames("toggle-document-scroller", {closed: !showScroller})}
              data-testid="toggle-document-scroller"
              onClick={handleToggleScroller}
            >
              <ToggleDocumentScrollerIcon />
            </button>
            {!showScroller &&
              <button
                className={classNames("switch-document-button previous", {disabled: !prevBtnEnabled})}
                data-testid="switch-document-button-previous"
                onClick={prevBtnEnabled ? handleSwitchDocument("previous") : undefined}
              >
                <SwitchDocumentIcon />
              </button>
            }
            {showExemplarShare && <ExemplarVisibilityCheckbox document={openDocument} />}
            <DocumentTitle document={openDocument} />
            {!showScroller &&
              <button
                className={classNames("switch-document-button next", {disabled: !nextBtnEnabled})}
                data-testid="switch-document-button-next"
                onClick={nextBtnEnabled ? handleSwitchDocument("next") : undefined}
              >
                <SwitchDocumentIcon />
              </button>
            }
            <div className="document-buttons">
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
                toolbar={appConfig.myResourcesToolbar({showPlayback, showEdit})}
              />
          }
          {
            openDocument && !isVisible &&
              <div className="document-error">
                <p>This document is not shared with you right now.</p>
              </div>
          }
          { !openDocument && <DocumentLoadingSpinner/> }
        </div>
      )}
    </>
  );
});
