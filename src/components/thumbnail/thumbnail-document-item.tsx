import React from "react";
import { observer } from "mobx-react";
import { CanvasComponent } from "../document/canvas";
import { DocumentModelType } from "../../models/document/document";
import { GroupDocument } from "../../models/document/document-types";
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
  const handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDocumentDragStart?.(e, document);
  };
  const handleDocumentStarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!user.isResearcher) {
      onDocumentStarClick?.(document);
    }
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
  const isPrivate = !document.isAccessibleToUser(user, documents);
  const documentTitle = appMode !== "authed" && appMode !== "demo"
                          ? `Firebase UID: ${document.key}` : undefined;

  const className = classNames("list-item", {
    private: isPrivate, selected: isSelected, secondary: isSecondarySelected
  });
  return (
    <div className={className}
      data-test={dataTestName} key={document.key} data-document-key={document.key}
      title={documentTitle} onClick={isPrivate ? undefined : handleDocumentClick}
    >
      <div
        className={classNames("scaled-list-item-container", { group })}
        onDragStart={handleDocumentDragStart}
        draggable={!!onDocumentDragStart && !isPrivate}
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
        {group && <div className="group-doc-badge"><GroupIcon color="#fff" /></div>}
      </div>
      {
        onDocumentStarClick &&
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
