import React, { PropsWithChildren } from "react";
import { Editor, EFormat, useSlate } from "@concord-consortium/slate-editor";

import { LinkButton } from "./link-button";
import { isMac } from "../../../../utilities/browser";
import { registerTileToolbarButtons } from "../../../toolbar/toolbar-button-manager";
import { TileToolbarButton } from "../../../toolbar/tile-toolbar-button";

import BoldToolIcon from "../../../../assets/icons/text/bold-text-icon.svg";
import ItalicToolIcon from "../../../../assets/icons/text/italic-text-icon.svg";
import UnderlineToolIcon from "../../../../assets/icons/text/underline-text-icon.svg";
import SuperscriptToolIcon from "../../../../assets/icons/text/superscript-text-icon.svg";
import SubscriptToolIcon from "../../../../assets/icons/text/subscript-text-icon.svg";
import NumberedListToolIcon from "../../../../assets/icons/text/numbered-list-text-icon.svg";
import BulletedListToolIcon from "../../../../assets/icons/text/bulleted-list-text-icon.svg";

import "./text-toolbar.sass";

const kShortcutPrefix = isMac() ? "Cmd-" : "Ctrl-";

const toggleMark =
  (editor: Editor, format: EFormat) => editor.toggleMark(format);
const toggleSupSub =
  (editor: Editor, format: EFormat) => editor.toggleSuperSubscript(format as EFormat.subscript | EFormat.superscript);
const toggleElement =
  (editor: Editor, format: EFormat) => editor.toggleElement(format);

interface IGenericTextToolbarButtonProps {
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>,
  slateType: EFormat,
  toggleFunc: (editor: Editor, format: EFormat) => void
}

function GenericTextToolbarButton({Icon, slateType, toggleFunc}: IGenericTextToolbarButtonProps) {
  const editor = useSlate();
  const selected = editor.isMarkActive(slateType) || editor.isElementActive(slateType);
  function handleClick (e : React.MouseEvent) {
    e.stopPropagation();
    toggleFunc(editor, slateType);
  }
  return (
    <TileToolbarButton selected={selected} onClick={handleClick}>
      <Icon/>
    </TileToolbarButton>);
}

function BoldToolbarButton() {
  return <GenericTextToolbarButton
    Icon={BoldToolIcon} slateType={EFormat.bold} toggleFunc={toggleMark}/>;
}

function ItalicToolbarButton() {
  return <GenericTextToolbarButton
    Icon={ItalicToolIcon} slateType={EFormat.italic} toggleFunc={toggleMark}/>;
}

function UnderlineToolbarButton() {
  return <GenericTextToolbarButton
    Icon={UnderlineToolIcon} slateType={EFormat.underlined} toggleFunc={toggleMark}/>;
}

function SubscriptToolbarButton() {
  return <GenericTextToolbarButton
    Icon={SubscriptToolIcon} slateType={EFormat.subscript} toggleFunc={toggleSupSub}/>;
}

function SuperscriptToolbarButton() {
  return <GenericTextToolbarButton
    Icon={SuperscriptToolIcon} slateType={EFormat.superscript} toggleFunc={toggleSupSub}/>;
}

function NumberedListToolbarButton() {
  return <GenericTextToolbarButton
    Icon={NumberedListToolIcon} slateType={EFormat.numberedList} toggleFunc={toggleElement}/>;
}

function BulletedListToolbarButton() {
  return <GenericTextToolbarButton
    Icon={BulletedListToolIcon} slateType={EFormat.bulletedList} toggleFunc={toggleElement}/>;
}

registerTileToolbarButtons('text',
[
  {
    name: 'bold',
    title: 'Bold',
    keyHint: `${kShortcutPrefix}b`,
    component: BoldToolbarButton,
    defaultPosition: 1
  },
  {
    name: 'italic',
    title: 'Italic',
    keyHint: `${kShortcutPrefix}i`,
    component: ItalicToolbarButton,
    defaultPosition: 2
  },
  {
    name: 'underline',
    title: 'Underline',
    keyHint: `${kShortcutPrefix}u`,
    component: UnderlineToolbarButton,
    defaultPosition: 3
  },
  {
    name: 'subscript',
    title: 'Subscript',
    component: SubscriptToolbarButton,
    defaultPosition: 4
  },
  {
    name: 'superscript',
    title: 'Superscript',
    component: SuperscriptToolbarButton,
    defaultPosition: 5
  },
  {
    name: 'list-ol',
    title: 'Numbered List',
    component: NumberedListToolbarButton,
    defaultPosition: 6
  },
  {
    name: 'list-ul',
    title: 'Bulleted List',
    component: BulletedListToolbarButton,
    defaultPosition: 7
  },
  {
    name: 'link',
    title: 'Link',
    component: LinkButton,
    defaultPosition: 8
  }
]);

