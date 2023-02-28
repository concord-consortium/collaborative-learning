import React, { useEffect, useState } from "react";
import { CustomElement, Editor, EFormat, ReactEditor, Transforms } from "@concord-consortium/slate-editor";

import { useCustomModal } from "../../../../hooks/use-custom-modal";

import LinkIcon from "../../../../assets/icons/text/link-text-icon.svg";
import './use-link-dialog.scss';

interface IContentProps {
  setUrl: React.Dispatch<React.SetStateAction<string>>;
  text: string;
  url: string;
}
export const LinkDialogContent = ({ setUrl, text, url }: IContentProps) => {
  return (
    <div className="link-dialog-content">
      <p>{text}</p>
      <input
        placeholder="Url"
        onChange={e => setUrl(e.target.value)}
        type="text"
        value={url}
      />
    </div>
  );
};

interface IProps {
  editor: Editor;
  onClose?: () => void;
  selectedLink?: any;
  text: string;
}
export const useLinkDialog = ({ editor, onClose, selectedLink, text }: IProps) => {
  const [url, setUrl] = useState(selectedLink?.href ?? "");
  useEffect(() => {
    setUrl(selectedLink?.href ?? "");
  }, [selectedLink]);

  const handleClick = () => {
    if (selectedLink) {
      const at = ReactEditor.findPath(editor, selectedLink);
      if (url === "") {
        // Remove link if the url is deleted
        Transforms.unwrapNodes(editor, { at });
      } else {
        // Update the url
        Transforms.setNodes(
          editor,
          { ...selectedLink, href: url },
          { at }
        );
      }
    } else {
      // Create a new link
      const element = {
        type: EFormat.link,
        href: url
      } as CustomElement;
      Transforms.wrapNodes(editor, element, { split: true });
      Transforms.collapse(editor, { edge: "end" });
    }
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: LinkIcon,
    title: "Link Editor",
    Content: LinkDialogContent,
    contentProps: { setUrl, text, url },
    buttons: [
      { label: "Cancel" },
      { label: "Save",
        isDefault: true,
        onClick: handleClick
      }
    ],
    onClose
  }, [selectedLink, text, url]);

  return [showModal, hideModal];
};
