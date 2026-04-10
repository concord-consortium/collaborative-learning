import React, { useEffect, useState } from "react";
import { CustomElement, Editor, EFormat, ReactEditor, Transforms } from "@concord-consortium/slate-editor";

import { useCustomModal } from "../../../../hooks/use-custom-modal";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../../../lib/logger-types";

import LinkIcon from "../../../../assets/icons/text/link-text-icon.svg";
import './use-link-dialog.scss';

type DisplayMode = "link" | "button";

interface IContentProps {
  setUrl: React.Dispatch<React.SetStateAction<string>>;
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  text: string;
  url: string;
}
export const LinkDialogContent = ({ setUrl, displayMode, setDisplayMode, text, url }: IContentProps) => {
  return (
    <div className="link-dialog-content">
      <p>Link text: {text}</p>
      <input
        placeholder="URL"
        onChange={e => setUrl(e.target.value)}
        spellCheck={false}
        type="url"
        value={url}
      />
      <fieldset className="display-as-fieldset">
        <legend>Display as:</legend>
        <div className="radio-button-container">
          <input
            type="radio"
            id="display-link"
            name="displayMode"
            value="link"
            checked={displayMode === "link"}
            onChange={e => { if (e.target.checked) setDisplayMode("link"); }}
          />
          <label htmlFor="display-link">Link</label>
        </div>
        <div className="radio-button-container">
          <input
            type="radio"
            id="display-button"
            name="displayMode"
            value="button"
            checked={displayMode === "button"}
            onChange={e => { if (e.target.checked) setDisplayMode("button"); }}
          />
          <label htmlFor="display-button">Button</label>
        </div>
      </fieldset>
    </div>
  );
};

interface IProps {
  editor: Editor;
  onClose?: () => void;
  selectedLink?: any;
  text: string;
  tileId?: string;
}
export const useLinkDialog = ({ editor, onClose, selectedLink, text, tileId }: IProps) => {
  const [url, setUrl] = useState(selectedLink?.href ?? "");
  const [displayMode, setDisplayMode] = useState<string>(selectedLink?.displayMode ?? "link");

  useEffect(() => {
    setUrl(selectedLink?.href ?? "");
    setDisplayMode(selectedLink?.displayMode ?? "link");
  }, [selectedLink]);

  const handleDisplayModeChange = (mode: string) => {
    setDisplayMode(mode);
    if (tileId) {
      logTileChangeEvent(LogEventName.TEXT_LINK_DISPLAY_CHANGE, {
        operation: "display-mode-change",
        change: { displayMode: mode },
        tileId
      });
    }
  };

  const handleClick = () => {
    if (selectedLink) {
      const at = ReactEditor.findPath(editor, selectedLink);
      if (url === "") {
        Transforms.unwrapNodes(editor, { at });
      } else {
        Transforms.setNodes(
          editor,
          { ...selectedLink, href: url, displayMode },
          { at }
        );
      }
    } else {
      const element = {
        type: EFormat.link,
        href: url,
        displayMode
      } as CustomElement;
      Transforms.wrapNodes(editor, element, { split: true });
      Transforms.collapse(editor, { edge: "end" });
    }
  };

  const [showModal, hideModal] = useCustomModal({
    className: "link-editor-modal",
    Icon: LinkIcon,
    title: "Link Editor",
    Content: LinkDialogContent,
    contentProps: { setUrl, displayMode, setDisplayMode: handleDisplayModeChange, text, url },
    buttons: [
      { label: "Cancel" },
      { label: "Save",
        isDefault: true,
        onClick: handleClick
      }
    ],
    onClose
  }, [selectedLink, text, url, displayMode, tileId]);

  return [showModal, hideModal];
};
