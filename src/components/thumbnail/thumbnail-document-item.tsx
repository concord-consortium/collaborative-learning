import * as React from "react";
import { CanvasComponent } from "../document/canvas";
import { DocumentModelType } from "../../models/document/document";
import { observer } from "mobx-react";
import { IStores } from "../../models/stores/stores";

export enum ThumbnailDocumentItemRole {
  PrimaryDoc = "primary-doc",
  ComparisonDoc = "comparison-doc"
}

interface IProps {
  dataTestName: string;
  canvasContext: string;
  document: DocumentModelType;
  scale: number;
  captionText: string;
  role?: ThumbnailDocumentItemRole;
  onIsStarred: () => boolean;
  onDocumentClick: (document: DocumentModelType) => void;
  onDocumentDragStart?: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
  onDocumentDeleteClick?: (document: DocumentModelType) => void;
}

export const ThumbnailDocumentItem = observer((props: IProps) => {
  const { dataTestName, canvasContext, document, scale, captionText, onIsStarred,
          onDocumentClick, onDocumentDragStart, onDocumentStarClick,
        onDocumentDeleteClick, role } = props;
  const handleDocumentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onDocumentClick && onDocumentClick(document);
  };
  const handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDocumentDragStart && onDocumentDragStart(e, document);
  };
  const handleDocumentStarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onDocumentStarClick && onDocumentStarClick(document);
  };
  const handleDocumentDeleteClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onDocumentDeleteClick && onDocumentDeleteClick(document);
  };
  const className = `list-item${role ? ` ${role}` : ""}`;
  return (
    <div
      className={className}
      data-test={dataTestName}
      data-thumbnail-key={document.key}
      key={document.key} >

      <div
        className="scaled-list-item-container"
        onClick={handleDocumentClick}
        onDragStart={handleDocumentDragStart}
        draggable={!!onDocumentDragStart} >

        <div className="scaled-list-item">
          <CanvasComponent context={canvasContext} document={document}
                            readOnly={true} scale={scale} />
        </div>
      </div>

      <DocumentCaption
        captionText={captionText}
        isStarred={onIsStarred()}
        onStarClick={onDocumentStarClick ? handleDocumentStarClick : undefined}
        onDeleteClick={onDocumentDeleteClick ? handleDocumentDeleteClick : undefined}
      />
    </div>
  );
});

/*
 * DocumentCaption
 */
interface IDocumentCaptionProps {
  captionText: string;
  isStarred?: boolean;
  onStarClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDeleteClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const DocumentCaption = (props: IDocumentCaptionProps) => {
  const { captionText, isStarred, onStarClick, onDeleteClick } = props;
  return (
    <div className="footer">
      <div className="info">
        <div>{captionText}</div>
      </div>
      {onStarClick
        ? <DocumentStar isStarred={!!isStarred} onStarClick={onStarClick} />
        : null}
      {onDeleteClick
        ? <DocumentDelete onDeleteClick={onDeleteClick} />
        : null}
    </div>
  );
};

/*
 * DocumentStar
 */
interface IDocumentStarProps {
  isStarred: boolean;
  onStarClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const DocumentStar = (props: IDocumentStarProps) => {
  const { isStarred, onStarClick } = props;
  return (
    <div className="icon-holder" onClick={onStarClick}>
      <svg className={"icon-star " + (isStarred ? "starred" : "")} >
        <use xlinkHref="#icon-star"/>
      </svg>
    </div>
  );
};

interface IDocumentDeleteProps {
  onDeleteClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const DocumentDelete = (props: IDocumentDeleteProps) => {
  const { onDeleteClick } = props;
  return (
    <div className="icon-holder" onClick={onDeleteClick}>
      <svg className="icon-delete-document">
        <use xlinkHref="#icon-delete-document"/>
      </svg>
    </div>
  );
};
