import React from "react";
import { observer } from "mobx-react";
import { CanvasComponent } from "../document/canvas";
import { DocumentModelType } from "../../models/document/document";
import { DrivingQuestionBoardDocument, GroupDocument } from "../../models/document/document-types";
import { DocumentCaption } from "./document-caption";
import { ThumbnailPlaceHolderIcon } from "./thumbnail-placeholder-icon";
import { ThumbnailPrivateIcon } from "./thumbnail-private-icon";
import { useAppMode, useClassStore, useStores } from "../../hooks/use-stores";
import ThumbnailBookmark from "../../assets/thumbnail-bookmark-icon.svg";
import GroupIcon from "../../assets/icons/document-thumbnail/student-group-icon.svg";
import classNames from "classnames";
import { DEBUG_BOOKMARKS } from "../../lib/debug";

interface IProps {
  canvasContext: string;
  captionText: string;
  dataTestName: string;
  document: DocumentModelType;
  isSecondarySelected?: boolean;
  isSelected?: boolean;
  onDocumentClick: (document: DocumentModelType) => void;
  onDocumentDeleteClick?: (document: DocumentModelType) => void;
  onDocumentDragStart?: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
  scale: number;
}

export const ThumbnailDocumentItem: React.FC<IProps> = observer((props: IProps) => {
  const {
    dataTestName, canvasContext, document, scale, captionText, isSelected, isSecondarySelected,
    onDocumentClick, onDocumentDragStart, onDocumentStarClick, onDocumentDeleteClick
  } = props;
  const appMode = useAppMode();
  const { bookmarks, user, documents } = useStores();
  const classStore = useClassStore();

  const handleDocumentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onDocumentClick?.(document);
    e.stopPropagation();
  };
  const handleDocumentKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onDocumentClick?.(document);
    }
  };
  const handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDocumentDragStart?.(e, document);
  };
  const handleDocumentStarClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onDocumentStarClick?.(document);
    e.stopPropagation();
  };
  const handleDocumentDeleteClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!user.isResearcher) {
      onDocumentDeleteClick?.(document);
    }
    e.stopPropagation();
  };


  // We were only showing stars to teachers if that teacher owned the star. This was changed to show all
  // stars regardless of who placed the star.
  // const isStarred = user.isTeacher
  //   ? stars.isDocumentBookmarkedByUser(document.key, user.id)
  //   : stars.isDocumentBookmarked(document.key);
  const isStarred = bookmarks.isDocumentBookmarked(document.key);

  const label = DEBUG_BOOKMARKS ? bookmarks.getBookmarkLabel(document.key, user.id, classStore) : "";

  // The class-wide Driving Question Board reuses the group document thumbnail styling
  // (purple border + corner icon badge).
  const group = document.type === GroupDocument || document.type === DrivingQuestionBoardDocument;
  const isPrivate = !document.isAccessibleToUser(user, documents);
  const documentTitle = appMode !== "authed" && appMode !== "demo"
                          ? `Firebase UID: ${document.key}` : undefined;

  const className = classNames("list-item", {
    private: isPrivate, selected: isSelected, secondary: isSecondarySelected
  });
  return (
    <div className="list-item-container" key={document.key}>
      <div className={className}
        data-test={dataTestName} data-document-key={document.key}
        title={documentTitle}
        role="button"
        tabIndex={0}
        aria-label={captionText}
        aria-current={isSelected ? "true" : undefined}
        aria-disabled={isPrivate || undefined}
        onClick={isPrivate ? undefined : handleDocumentClick}
        onKeyDown={isPrivate ? undefined : handleDocumentKeyDown}
        onDragStart={!isPrivate && onDocumentDragStart ? handleDocumentDragStart : undefined}
        draggable={!!onDocumentDragStart && !isPrivate}
      >
        <div
          className={classNames("scaled-list-item-container", { group })}
          aria-hidden={true}
          // Spread bypasses React 17's type definitions, which lack `inert`.
          {...{ inert: "" }}
        >
          { isPrivate
            ? <ThumbnailPrivateIcon />
            : document.content
              ? <div className="scaled-list-item">
                  <CanvasComponent
                    context={canvasContext}
                    document={document}
                    readOnly={true}
                    scale={scale}
                  />
                </div>
              : <ThumbnailPlaceHolderIcon />
          }
          {group && (
            <div className="group-doc-badge">
              <GroupIcon color="#fff" aria-hidden={true} focusable={false} />
            </div>
          )}
        </div>
        <DocumentCaption
          captionText={captionText}
          onDeleteClick={onDocumentDeleteClick ? handleDocumentDeleteClick : undefined}
        />
      </div>
      {
        onDocumentStarClick &&
        <DocumentBookmark
          isStarred={isStarred}
          onStarClick={handleDocumentStarClick}
          label={label}
          disabled={user.isResearcher}
        />
      }
    </div>
  );
});
ThumbnailDocumentItem.displayName = "ThumbnailDocumentItem";

/*
 * DocumentStar
 */
interface IDocumentStarProps {
  isStarred: boolean;
  onStarClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  label: string;
  disabled?: boolean;
}

const DocumentBookmark = (props: IDocumentStarProps) => {
  const { isStarred, onStarClick, label, disabled } = props;
  const ariaLabel = isStarred ? "Remove bookmark" : "Bookmark document";

  return (
    <button
      aria-disabled={disabled || undefined}
      aria-pressed={isStarred}
      aria-label={ariaLabel}
      className="icon-holder"
      data-testid="bookmark-button"
      type="button"
      onClick={disabled ? undefined : onStarClick}
    >
      <svg className={"icon-star " + (isStarred ? "starred" : "")} aria-hidden="true">
        <ThumbnailBookmark />
      </svg>
      {label && <span className="bookmark-label">{label}</span>}
    </button>
    );
};
