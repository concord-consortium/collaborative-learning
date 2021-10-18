import React from "react";
import { observer } from "mobx-react";
import { CanvasComponent } from "../document/canvas";
import { DocumentModelType } from "../../models/document/document";
import { DocumentCaption } from "./document-caption";
import { ThumbnailPlaceHolderIcon } from "./thumbnail-placeholder-icon";

interface IProps {
  dataTestName: string;
  canvasContext: string;
  document: DocumentModelType;
  scale: number;
  captionText: string;
  isSelected?: boolean;
  onIsStarred: () => boolean;
  onDocumentClick: (document: DocumentModelType) => void;
  onDocumentDragStart?: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
  onDocumentDeleteClick?: (document: DocumentModelType) => void;
}

export const ThumbnailDocumentItem = observer((props: IProps) => {
  const { dataTestName, canvasContext, document, scale, captionText, isSelected, onIsStarred,
          onDocumentClick, onDocumentDragStart, onDocumentStarClick,
          onDocumentDeleteClick } = props;
  const selectedClass = isSelected ? "selected" : "";

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

  return (
    <div className={`list-item ${selectedClass}`} data-test={dataTestName} key={document.key}
      onClick={handleDocumentClick}>
      <div className="scaled-list-item-container" onDragStart={handleDocumentDragStart}
        draggable={!!onDocumentDragStart}>
        { document.content
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
      { onDocumentStarClick &&
          <DocumentStar isStarred={onIsStarred()} onStarClick={handleDocumentStarClick} />
      }
      <DocumentCaption
        captionText={captionText}
        onDeleteClick={onDocumentDeleteClick ? handleDocumentDeleteClick : undefined}
      />
    </div>
  );
});

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


