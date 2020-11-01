import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { Tooltip } from "react-tippy";
import UploadButtonSvg from "../../../assets/icons/upload-image/upload-image-icon.svg";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";

import "react-tippy/dist/tippy.css";
import "./image-toolbar.scss";

interface IImageUploadButtonProps {
  tooltipOffset?: { x?: number, y?: number };
  onUploadImageFile: (file: File) => void;
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
      onUploadImageFile(files[0]);
    }
  };
  return (
    <Tooltip title="Upload image" size="small"
              position="bottom" distance={tooltipOffset?.y || 0} offset={tooltipOffset?.x || 0}
              animation="fade" animateFill={false} >
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
export const ImageToolbar: React.FC<IProps> = observer(({
  documentContent, onIsEnabled, onUploadImageFile, ...others
}) => {
  const enabled = onIsEnabled();
  const location = useFloatingToolbarLocation({
                    documentContent,
                    toolbarHeight: 34,
                    toolbarTopOffset: 2,
                    enabled,
                    ...others
                  });
  // required for proper placement and label centering
  const tooltipOffset = { x: -19, y: -32 };
  return documentContent && enabled && location
    ? ReactDOM.createPortal(
        <div className={`image-toolbar ${enabled ? "enabled" : ""}`}
            style={location}
            onMouseDown={e => e.stopPropagation()}>
          <ImageUploadButton tooltipOffset={tooltipOffset} onUploadImageFile={onUploadImageFile} />
        </div>, documentContent)
    : null;
});
