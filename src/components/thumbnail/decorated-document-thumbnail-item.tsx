import { observer } from "mobx-react";
import React from "react";

import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { useDocumentCaption } from "../../hooks/use-document-caption";
import { useDocumentSyncToFirebase } from "../../hooks/use-document-sync-to-firebase";
import { useLastSupportViewTimestamp } from "../../hooks/use-last-support-view-timestamp";
import { DocumentModelType } from "../../models/document/document";
import { useDBStore, useUIStore, useUserStore } from "../../hooks/use-stores";
import { NavTabSectionModelType } from "../../models/view/nav-tabs";

import "./document-type-collection.sass";
import { SupportPublication } from "../../models/document/document-types";
import { logDocumentEvent } from "../../models/document/log-document-event";
import { LogEventName } from "../../lib/logger-types";

interface IProps {
  onDocumentDragStart?: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  shouldHandleStarClick?: boolean;
  onSelectDocument?: (document: DocumentModelType) => void;
  scale: number;
  section: NavTabSectionModelType;
  document: DocumentModelType;
  selectedDocument?: string;
  selectedSecondaryDocument?: string;
  tab: string;
}

// observes teacher names via useDocumentCaption()
export const DecoratedDocumentThumbnailItem: React.FC<IProps> = observer(({
  section, document, tab, scale, selectedDocument, selectedSecondaryDocument,
  onSelectDocument, onDocumentDragStart, shouldHandleStarClick
}: IProps) => {
    const user = useUserStore();
    const dbStore = useDBStore();
    const tabName = tab.toLowerCase().replace(' ', '-');
    const caption = useDocumentCaption(document);
    const ui = useUIStore();

    // sync delete a publication to firebase
    useDocumentSyncToFirebase(user, dbStore.firebase, document, true);

    // sync user's last support view time stamp to firebase
    useLastSupportViewTimestamp(section.type === "teacher-supports");

    function handleDocumentClick() {
      onSelectDocument?.(document);
      (section.type === "teacher-supports") && user.setLastSupportViewTimestamp(Date.now());
    }
    function handleDocumentDragStart(e: React.DragEvent<HTMLDivElement>) {
      onDocumentDragStart?.(e, document);
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
      return section.showStarsForUser(user)
          // We weren't showing stars that a "co-teacher" has placed on a document even though the document
          // is classified as "isStarred". We commented out lines 88-90 to show all starred documents regardless of who
          // placed the star.
              // ? user.isTeacher
              //   ? sectionDocument.isStarredByUser(user.id)
              //   : sectionDocument.isStarred
                ? document.isStarred
                : false;
    };
    const _handleDocumentStarClick = section.showStarsForUser(user) && !document.isRemote
                                      ? handleDocumentStarClick
                                      : undefined;
    const _handleDocumentDeleteClick = section.showDeleteForUser(user, document)
                                        ? handleDocumentDeleteClick
                                        : undefined;

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
