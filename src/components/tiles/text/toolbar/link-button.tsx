import React from "react";
import { Editor, EFormat, Node, Range, selectedNodesOfType, useSlate } from "@concord-consortium/slate-editor";

import { useLinkDialog } from "../dialog/use-link-dialog";
import { TileToolbarButton } from "../../../toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../toolbar/toolbar-button-manager";

import LinkToolIcon from "../../../../assets/icons/text/link-text-icon.svg";

export const LinkButton = ({name}: IToolbarButtonComponentProps) => {
  const editor = useSlate();
  const { selection } = editor;
  const isCollapsed = selection ? Range.isCollapsed(selection) : true;
  const selectedLinks = selectedNodesOfType(editor, EFormat.link);
  const selectedLink = selectedLinks[0] || undefined;
  const isSelected = !!selectedLink;
  const disabled = isCollapsed && !isSelected;
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
  return(
    <TileToolbarButton name={name} title="Link" disabled={disabled} selected={isSelected} onClick={handleClick}>
      <LinkToolIcon/>
    </TileToolbarButton>
  );
};
