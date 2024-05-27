import React, { PropsWithChildren, useRef } from "react";
import { TileToolbarButton } from "./tile-toolbar-button";

export interface IUploadButtonComponentProps {
  name: string;       // a unique internal name used in configuration to identify the button
  title: string;      // user-visible name, used in the tooltip
  keyHint?: string,   // If set, displayed to the user as the hotkey equivalent
  accept?: string,     // MIME types accepted
  onUpload: (file: File) => void; // Action when a file is uploaded
  selected?: boolean; // puts button in 'active' state if defined and true
  disabled?: boolean; // makes button grey and unclickable if defined and true
}

/**
 * A TileToolbarButton that is for uploading files.
 * It contains a hidden input element, and the toolbar button forwards a click to it.
 */
export const UploadButton =
  function({name, title, keyHint, accept, onUpload, selected, disabled, children}:
    PropsWithChildren<IUploadButtonComponentProps>) {
  const inputRef = useRef<HTMLInputElement>(null);

  // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file
  // Hide the <input> element — we do this because file inputs tend to be ugly, difficult
  // to style, and inconsistent in their design across browsers. Opacity is used to hide the file
  // input instead of visibility: hidden or display: none, because assistive technology interprets
  // the latter two styles to mean the file input isn't interactive.
  const hideFileInputStyle = { opacity: 0, width: 1, height: 1, maxWidth: 1, maxHeight: 1 };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files?.length) {
      onUpload(files[0]);
    }
  };

  const input =
      <input
        ref={inputRef}
        type="file"
        style={hideFileInputStyle}
        accept={accept || "image/png, image/jpeg"}
        title={title}
        onChange={handleFileInputChange}
        className="upload-button-input"
      />;

  return (
    <TileToolbarButton
      name={name}
      title={title}
      keyHint={keyHint}
      disabled={disabled}
      selected={selected}
      onClick={() => { inputRef.current?.click(); }}
      extraContent={input}
    >
      {children}
    </TileToolbarButton>
  );
};
