import React from "react";
import { Tooltip } from "react-tippy";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import DeleteThumbIcon from "../../assets/icons/delete/delete-thumb-icon.svg";
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
  const tooltipOptions = useTooltipOptions({distance: 12});
  return (
    <div className="icon-holder" onClick={onDeleteClick}>
      <Tooltip title="Delete" {...tooltipOptions} >
        <div className="icon-delete-document">
          <DeleteThumbIcon />
        </div>
      </Tooltip>
    </div>
  );
};
