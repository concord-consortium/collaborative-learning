import * as React from "react";
import { CanvasComponent } from "../document/canvas";
import { DocumentModelType } from "../../models/document/document";
import { observer } from "mobx-react";

interface IProps {
  dataTestName: string;
  canvasContext: string;
  document: DocumentModelType;
  scale: number;
  captionText: string;
  onIsStarred: () => boolean;
  onDocumentClick: (document: DocumentModelType) => void;
  onDocumentDragStart?: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
}

export const ThumbnailDocumentItem = observer((props: IProps) => {
  const { dataTestName, canvasContext, document, scale, captionText, onIsStarred,
          onDocumentClick, onDocumentDragStart, onDocumentStarClick } = props;
  const handleDocumentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onDocumentClick && onDocumentClick(document);
  };
  const handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDocumentDragStart && onDocumentDragStart(e, document);
  };
  const handleDocumentStarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onDocumentStarClick && onDocumentStarClick(document);
  };
  return (
    <div
      className="list-item"
      data-test={dataTestName}
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

      <DocumentCaption captionText={captionText} isStarred={onIsStarred()}
                        onStarClick={onDocumentStarClick ? handleDocumentStarClick : undefined} />
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
}

const DocumentCaption = (props: IDocumentCaptionProps) => {
  const { captionText, isStarred, onStarClick } = props;
  return (
    <div className="footer">
      <div className="info">
        <div>{captionText}</div>
      </div>
      {onStarClick
        ? <DocumentStar isStarred={!!isStarred} onStarClick={onStarClick} />
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
