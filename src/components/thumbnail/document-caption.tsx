import React from "react";

interface IDocumentCaptionProps {
  captionText: string;
  onDeleteClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const DocumentCaption = (props: IDocumentCaptionProps) => {
  const { captionText, onDeleteClick } = props;
  return (
    <div className="footer">
      <div className="info">
        <div>{captionText}</div>
      </div>
      { onDeleteClick && <DocumentDelete onDeleteClick={onDeleteClick} /> }
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
