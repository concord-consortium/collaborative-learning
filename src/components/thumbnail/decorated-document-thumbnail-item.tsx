import { observer } from "mobx-react";
import React from "react";

import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { useDocumentCaption } from "../../hooks/use-document-caption";
import { useDocumentSyncToFirebase } from "../../hooks/use-document-sync-to-firebase";
import { DocumentModelType } from "../../models/document/document";
import { useDBStore, useStores, useUIStore, useUserStore } from "../../hooks/use-stores";
import { DocumentDragKey, SupportPublication } from "../../models/document/document-types";
import { logDocumentEvent } from "../../models/document/log-document-event";
import { LogEventName } from "../../lib/logger-types";

import "./document-type-collection.sass";

interface IProps {
  shouldHandleStarClick: boolean;
  onSelectDocument?: (document: DocumentModelType) => void;
  scale: number;
  document: DocumentModelType;
  selectedDocument?: string;
  selectedSecondaryDocument?: string;
  allowDelete: boolean;
  tab: string;
}

// observes teacher names via useDocumentCaption()
export const DecoratedDocumentThumbnailItem: React.FC<IProps> = observer(({
  document, tab, scale, selectedDocument, selectedSecondaryDocument, allowDelete,
  onSelectDocument, shouldHandleStarClick
}: IProps) => {
    const user = useUserStore();
    const dbStore = useDBStore();
    const tabName = tab.toLowerCase().replace(' ', '-');
    const caption = useDocumentCaption(document);
    const ui = useUIStore();
    const { stars } = useStores();

    // sync delete a publication to firebase
    useDocumentSyncToFirebase(user, dbStore.firebase, document, true);

    function handleDocumentDragStart(e: React.DragEvent<HTMLDivElement>) {
      e.dataTransfer.setData(DocumentDragKey, document.key);
    }

    function handleDocumentStarClick() {
      shouldHandleStarClick && document?.toggleUserStar(user.id);
    }

    function handleDocumentDeleteClick() {
      ui.confirm("Do you want to delete this?", "Confirm Delete")
      .then(ok => {
        if (ok) {
          document.setProperty("isDeleted", "true");
          if (document.type === SupportPublication) {
            // TODO: log all the deletions?
            logDocumentEvent(LogEventName.DELETE_SUPPORT, { document });
          }
        }
      });
    }

    // pass function so logic stays here but access occurs from child
    // so that mobx-react triggers child render not parent render.
    const onIsStarred = () => {
      return shouldHandleStarClick
          // We weren't showing stars that a "co-teacher" has placed on a document even though the document
          // is classified as "isStarred". We commented out lines 88-90 to show all starred documents regardless of who
          // placed the star.
              // ? user.isTeacher
              //   ? sectionDocument.isStarredByUser(user.id)
              //   : sectionDocument.isStarred
                ? stars.isDocumentStarred(document.key)
                : false;
    };
    const _handleDocumentStarClick = shouldHandleStarClick && !document.isRemote
                                      ? handleDocumentStarClick
                                      : undefined;
    const userOwnsDocument = user.id === document.uid;
    const _handleDocumentDeleteClick = allowDelete && userOwnsDocument
                                        ? handleDocumentDeleteClick
                                        : undefined;

    const handleDocumentClick = () => {
      onSelectDocument?.(document);
    };

    return (
      <ThumbnailDocumentItem
        key={document.key}
        dataTestName={`${tabName}-list-items`}
        canvasContext={tab}
        document={document}
        scale={scale}
        isSelected={document.key === selectedDocument}
        isSecondarySelected={document.key === selectedSecondaryDocument}
        captionText={caption}
        onDocumentClick={handleDocumentClick}
        onDocumentDragStart={!document.isRemote ? handleDocumentDragStart: undefined}
        onIsStarred={onIsStarred}
        onDocumentStarClick={_handleDocumentStarClick}
        onDocumentDeleteClick={_handleDocumentDeleteClick}
      />
    );
});
DecoratedDocumentThumbnailItem.displayName = "DecoratedDocumentThumbnailItem";
