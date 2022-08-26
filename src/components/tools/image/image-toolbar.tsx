import classNames from "classnames";
import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { Tooltip } from "react-tippy";
import UploadButtonSvg from "../../../assets/icons/upload-image/upload-image-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";

import "./image-toolbar.scss";

// TODO The ImageUploadButton is now being used by three different tiles.
// It would be good to move it into a more generic location.
interface IImageUploadButtonProps {
  tooltipOffset?: { x?: number, y?: number };
  onUploadImageFile?: (file: File) => void;
  extraClasses?: string;
}
export const ImageUploadButton: React.FC<IImageUploadButtonProps> =
  ({ tooltipOffset, onUploadImageFile, extraClasses }) => {
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
  const classes = classNames("toolbar-button", "image-upload", extraClasses);
  return (
    <Tooltip title="Upload image" {...tooltipOptions}>
      <div className={classes}>
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
  return documentContent
    ? ReactDOM.createPortal(
        <div className={`image-toolbar ${enabled && location ? "enabled" : "disabled"}`}
            style={location}
            onMouseDown={e => e.stopPropagation()}>
          <ImageUploadButton tooltipOffset={tooltipOffset} onUploadImageFile={onUploadImageFile} />
        </div>, documentContent)
    : null;
});
