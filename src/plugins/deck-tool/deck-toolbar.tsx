import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { Tooltip } from "react-tippy";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import { IFloatingToolbarProps, useFloatingToolbarLocation }
  from "../../components/tools/hooks/use-floating-toolbar-location";
import UploadButtonSvg from "../../assets/icons/upload-image/upload-image-icon.svg";

import "./deck-toolbar.scss";

interface IImageUploadButtonProps {
  tooltipOffset?: { x?: number, y?: number };
  onUploadImageFile?: (file: File) => void;
}
export const ImageUploadButton: React.FC<IImageUploadButtonProps> = ({ tooltipOffset, onUploadImageFile }) => {
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file
  // Next, we hide the <input> element — we do this because file inputs tend to be ugly, difficult
  // to style, and inconsistent in their design across browsers. Opacity is used to hide the file
  // input instead of visibility: hidden or display: none, because assistive technology interprets
  // the latter two styles to mean the file input isn't interactive.
  const hideFileInputStyle = { opacity: 0 };
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files?.length) {
      onUploadImageFile?.(files[0]);
    }
  };
  const tooltipOptions = useTooltipOptions({
                          distance: tooltipOffset?.y || 0,
                          offset: tooltipOffset?.x || 0
                        });
  return (
    <Tooltip title="Upload image" {...tooltipOptions}>
      <div className="toolbar-button image-upload">
        <UploadButtonSvg />
        <input
          type="file"
          style={hideFileInputStyle}
          accept="image/png, image/jpeg"
          title=""
          onChange={handleFileInputChange}
        />
      </div>
    </Tooltip>
  );
};

interface IProps extends IFloatingToolbarProps {
  onUploadImageFile: (file: File) => void;
}

export const DeckToolToolBar: React.FC<IProps> = observer((
              { documentContent, toolTile, onIsEnabled, onUploadImageFile, ...others }: IProps) => {
  const enabled = onIsEnabled();
  const location = useFloatingToolbarLocation({
                  documentContent,
                  toolTile,
                  toolbarHeight: 34,
                  toolbarTopOffset: 2,
                  enabled,
                  ...others
                });
  const tooltipOffset = { x: -19, y: -32 };
  return documentContent
    ? ReactDOM.createPortal(
      <div className={`deck-tool-toolbar ${enabled && location ? "enabled" : "disabled"}`}
            style={location} onMouseDown={e => e.stopPropagation()}>
        <div className="toolbar-buttons">
          <ImageUploadButton tooltipOffset={tooltipOffset} onUploadImageFile={onUploadImageFile} />
        </div>
      </div>, documentContent)
  : null;
});
