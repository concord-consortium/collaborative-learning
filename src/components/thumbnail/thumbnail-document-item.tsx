import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { CanvasComponent } from "../document/canvas";
import { DocumentModelType } from "../../models/document/document";
import { IDocumentMetadataModel } from "../../models/document/document-metadata-model";
import { GroupDocument } from "../../models/document/document-types";
import { isDocumentAccessibleToUser } from "../../models/document/document-utils";
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
  documentMetadata?: IDocumentMetadataModel;
  isSecondarySelected?: boolean;
  isSelected?: boolean;
  onDocumentClick: (document: DocumentModelType) => void;
  onDocumentDeleteClick?: (document: DocumentModelType) => void;
  onDocumentDragStart?: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
  scale: number;
  // When true (large/"big" thumbnails), the document can be scrolled within the
  // thumbnail. The document subtree stays `inert` + `aria-hidden` (kept out of the tab
  // order and the a11y tree); since `inert` blocks native scrolling, we translate wheel
  // events into programmatic scrolling instead, keeping the thumbnail "scroll-only"
  // rather than fully interactive.
  scrollable?: boolean;
}

export const ThumbnailDocumentItem: React.FC<IProps> = observer((props: IProps) => {
  const {
    dataTestName, canvasContext, document, documentMetadata, scale, captionText, isSelected, isSecondarySelected,
    onDocumentClick, onDocumentDragStart, onDocumentStarClick, onDocumentDeleteClick, scrollable
  } = props;
  const appMode = useAppMode();
  const { bookmarks, user, documents } = useStores();
  const classStore = useClassStore();
  const listItemRef = useRef<HTMLDivElement>(null);

  // Large/"big" thumbnails are scroll-only: the document subtree is kept `inert` (out of
  // the tab order) and `aria-hidden`, which also blocks native scrolling. Translate wheel
  // events on the (non-inert) list item into programmatic scrolling of the inner document
  // so users can scroll without the tiles becoming focusable/interactive. A non-passive
  // listener is required so we can preventDefault the page scroll.
  useEffect(() => {
    if (!scrollable) return;
    const el = listItemRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      const content = el.querySelector<HTMLElement>(".document-content");
      if (!content) return;
      // When the inner document is already scrolled to its top/bottom edge, let the wheel
      // event through so the parent document grid (which holds many thumbnails) can scroll.
      const atTop = content.scrollTop <= 0;
      const atBottom = content.scrollTop + content.clientHeight >= content.scrollHeight;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) return;
      content.scrollTop += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [scrollable]);

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

  const group = document.type === GroupDocument;
  const isPrivate = !isDocumentAccessibleToUser({ document, documentMetadata, user, documents });
  const documentTitle = appMode !== "authed" && appMode !== "demo"
                          ? `Firebase UID: ${document.key}` : undefined;

  const className = classNames("list-item", {
    private: isPrivate, selected: isSelected, secondary: isSecondarySelected
  });
  return (
    <div className="list-item-container" key={document.key}>
      <div className={className} ref={listItemRef}
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
          // The rendered document is non-interactive in every thumbnail: hide its tile
          // content from the a11y tree (aria-hidden) and remove it from the tab order
          // (inert). Large/scrollable thumbnails are scrolled via a wheel handler on the
          // list item (see the effect above), since inert blocks native scrolling.
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
