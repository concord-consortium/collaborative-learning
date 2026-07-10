import { observer } from "mobx-react";
import React from "react";

import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { useDocumentCaption } from "../../hooks/use-document-caption";
import { useDocumentSyncToFirebase } from "../../hooks/use-document-sync-to-firebase";
import { DocumentModelType } from "../../models/document/document";
import { IDocumentMetadataModel } from "../../models/document/document-metadata-model";
import { useStores } from "../../hooks/use-stores";
import { DocumentDragKey, SupportPublication } from "../../models/document/document-types";
import { logDocumentEvent } from "../../models/document/log-document-event";
import { LogEventName } from "../../lib/logger-types";
import { kDragTiles } from "../tiles/tile-component";

import "./document-type-collection.scss";

interface IProps {
  shouldHandleStarClick: boolean;
  onSelectDocument?: (document: DocumentModelType) => void;
  scale: number;
  document: DocumentModelType;
  documentMetadata?: IDocumentMetadataModel;
  selectedDocument?: string;
  selectedSecondaryDocument?: string;
  allowDelete: boolean;
  tab: string;
  // true for large/"big" thumbnails that should be scrollable (see ThumbnailDocumentItem)
  scrollable?: boolean;
}

// observes teacher names via useDocumentCaption()
export const DecoratedDocumentThumbnailItem: React.FC<IProps> = observer(({
  document, documentMetadata, tab, scale, selectedDocument, selectedSecondaryDocument, allowDelete,
  onSelectDocument, shouldHandleStarClick, scrollable,
}: IProps) => {
    const { user, db: dbStore, bookmarks, ui } = useStores();
    const tabName = tab.toLowerCase().replace(' ', '-');
    const caption = useDocumentCaption(document);

    // sync delete a publication to firebase
    useDocumentSyncToFirebase(user, dbStore.firebase, dbStore.firestore, document, true);

    function handleDocumentDragStart(e: React.DragEvent<HTMLDivElement>) {
      // A tile drag started inside a scrollable ("big") thumbnail bubbles up to this draggable
      // list item. The tile's dragstart runs first (bubble phase) and populates kDragTiles, so
      // when that data is already present this is a tile copy, not a document drag — don't also
      // tag it with DocumentDragKey, or drop targets outside a document (e.g. the workspace)
      // would treat the tile copy as a document drag.
      if (Array.from(e.dataTransfer.types).includes(kDragTiles)) return;
      e.dataTransfer.setData(DocumentDragKey, document.key);
    }

    function handleDocumentStarClick() {
      shouldHandleStarClick && bookmarks.toggleUserBookmark(document.key, user.id);
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
        documentMetadata={documentMetadata}
        scale={scale}
        scrollable={scrollable}
        isSelected={document.key === selectedDocument}
        isSecondarySelected={document.key === selectedSecondaryDocument}
        captionText={caption}
        onDocumentClick={handleDocumentClick}
        onDocumentDragStart={!document.isRemote ? handleDocumentDragStart: undefined}
        onDocumentStarClick={_handleDocumentStarClick}
        onDocumentDeleteClick={_handleDocumentDeleteClick}
      />
    );
});
DecoratedDocumentThumbnailItem.displayName = "DecoratedDocumentThumbnailItem";
