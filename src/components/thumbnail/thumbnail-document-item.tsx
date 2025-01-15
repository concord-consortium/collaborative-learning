import React from "react";
import { observer } from "mobx-react";
import { CanvasComponent } from "../document/canvas";
import { DocumentModelType } from "../../models/document/document";
import { DocumentCaption } from "./document-caption";
import { ThumbnailPlaceHolderIcon } from "./thumbnail-placeholder-icon";
import { ThumbnailPrivateIcon } from "./thumbnail-private-icon";
import { useAppMode, useClassStore, useStores } from "../../hooks/use-stores";
import ThumbnailBookmark from "../../assets/thumbnail-bookmark-icon.svg";
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
  const selectedClass = isSelected ? "selected" : "";
  const appMode = useAppMode();
  const { bookmarks, user, documents } = useStores();
  const classStore = useClassStore();

  const handleDocumentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onDocumentClick?.(document);
    e.stopPropagation();
  };
  const handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDocumentDragStart?.(e, document);
  };
  const handleDocumentStarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onDocumentStarClick?.(document);
    e.stopPropagation();
  };
  const handleDocumentDeleteClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onDocumentDeleteClick?.(document);
    e.stopPropagation();
  };


  // We were only showing stars to teachers if that teacher owned the star. This was changed to show all
  // stars regardless of who placed the star.
  // const isStarred = user.isTeacher
  //   ? stars.isDocumentBookmarkedByUser(document.key, user.id)
  //   : stars.isDocumentBookmarked(document.key);
  const isStarred = bookmarks.isDocumentBookmarked(document.key);

  const label = DEBUG_BOOKMARKS ? bookmarks.getBookmarkLabel(document.key, user.id, classStore) : "";

  const isPrivate = !document.isAccessibleToUser(user, documents);
  const privateClass = isPrivate ? "private" : "";
  const documentTitle = appMode !== "authed" && appMode !== "demo"
                          ? `Firebase UID: ${document.key}` : undefined;

  return (
    <div className={classNames("list-item", selectedClass, privateClass, {"secondary": isSecondarySelected})}
      data-test={dataTestName} key={document.key} data-document-key={document.key}
      title={documentTitle} onClick={isPrivate ? undefined : handleDocumentClick}>
      <div className="scaled-list-item-container" onDragStart={handleDocumentDragStart}
        draggable={!!onDocumentDragStart && !isPrivate}>
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
      </div>
      {
        onDocumentStarClick && !user.isResearcher &&
        <DocumentBookmark isStarred={isStarred} onStarClick={handleDocumentStarClick} label={label}/>
      }
      <DocumentCaption
        captionText={captionText}
        onDeleteClick={onDocumentDeleteClick ? handleDocumentDeleteClick : undefined}
      />
    </div>
  );
});
ThumbnailDocumentItem.displayName = "ThumbnailDocumentItem";

/*
 * DocumentStar
 */
interface IDocumentStarProps {
  isStarred: boolean;
  onStarClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  label: string;
}

const DocumentBookmark = (props: IDocumentStarProps) => {
  const { isStarred, onStarClick, label } = props;

  return (
    <div className="icon-holder" onClick={onStarClick}>
      <svg className={"icon-star " + (isStarred ? "starred" : "")} >
        <ThumbnailBookmark />
      </svg>
      {label && <pre className={"bookmark-label"}>{label}</pre> }
    </div>
    );
};


