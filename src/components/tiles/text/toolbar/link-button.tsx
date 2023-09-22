import React from "react";
import { Editor, EFormat, Node, Range, selectedNodesOfType, useSlate } from "@concord-consortium/slate-editor";

import { TextToolbarButton } from "./text-toolbar-button";
import { useLinkDialog } from "../dialog/use-link-dialog";

import LinkToolIcon from "../../../../assets/icons/text/link-text-icon.svg";
import { TileToolbarButton } from "../../../toolbar/tile-toolbar-button";

export const LinkButton = () => {
  const editor = useSlate();
  const { selection } = editor;
  const isCollapsed = selection ? Range.isCollapsed(selection) : true;
  const selectedLinks = selectedNodesOfType(editor, EFormat.link);
  const selectedLink = selectedLinks[0] || undefined;
  const isSelected = !!selectedLink;
  const enabled = !isCollapsed || isSelected;
  const text = isSelected
    ? Node.string(selectedLink)
    : selection
    ? Editor.string(editor, selection)
    : "";
  const [showModal] = useLinkDialog({ editor, selectedLink, text });
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    showModal();
  };
  return <TileToolbarButton Icon={LinkToolIcon} enabled={enabled}
    selected={isSelected} onClick={handleClick} />;
};
