import React, { useEffect, useState } from "react";
import { v4 as uuid } from "uuid";
import { Editor, EFormat, ReactEditor, Transforms } from "@concord-consortium/slate-editor";
import { ClueLinkElement } from "../../../../plugins/text/link-plugin";

import { useCustomModal } from "../../../../hooks/use-custom-modal";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../../../lib/logger-types";
import { LinkDisplayMode, TextContentModelType } from "../../../../models/tiles/text/text-content";

import LinkIcon from "../../../../assets/icons/text/link-text-icon.svg";
import './use-link-dialog.scss';

interface IContentProps {
  setUrl: React.Dispatch<React.SetStateAction<string>>;
  displayMode: LinkDisplayMode;
  setDisplayMode: (mode: LinkDisplayMode) => void;
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
  textContent: TextContentModelType;
}
export const useLinkDialog = ({ editor, onClose, selectedLink, text, tileId, textContent }: IProps) => {
  const [url, setUrl] = useState<string>(selectedLink?.href ?? "");
  const [displayMode, setDisplayMode] = useState<LinkDisplayMode>(
    textContent.getLinkDisplayMode(selectedLink?.linkId)
  );

  useEffect(() => {
    setUrl(selectedLink?.href ?? "");
    setDisplayMode(textContent.getLinkDisplayMode(selectedLink?.linkId));
  }, [selectedLink, textContent]);

  const handleDisplayModeChange = (mode: LinkDisplayMode) => {
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
        // Remove link if the url is deleted; also clear its display preference
        if (selectedLink.linkId) {
          textContent.removeLinkDisplayMode(selectedLink.linkId);
        }
        Transforms.unwrapNodes(editor, { at });
      } else {
        // Reuse the existing linkId if present; otherwise generate a new one
        // so the display mode has a stable key to target.
        const linkId = selectedLink.linkId ?? uuid();
        // Strip the legacy CLUE-476 displayMode field if present, so we don't
        // leave it on the slate element.
        const { displayMode: _unused, ...rest } = selectedLink;
        Transforms.setNodes(
          editor,
          { ...rest, href: url, linkId },
          { at }
        );
        textContent.setLinkDisplayMode(linkId, displayMode);
      }
    } else {
      // Create a new link with a fresh linkId
      const linkId = uuid();
      const element: ClueLinkElement = {
        type: EFormat.link as ClueLinkElement["type"],
        href: url,
        linkId,
        children: []
      };
      Transforms.wrapNodes(editor, element, { split: true });
      Transforms.collapse(editor, { edge: "end" });
      textContent.setLinkDisplayMode(linkId, displayMode);
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
  }, [selectedLink, text, url, displayMode, tileId, textContent]);

  return [showModal, hideModal];
};
