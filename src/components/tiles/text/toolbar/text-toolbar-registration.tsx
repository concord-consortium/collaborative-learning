import React from "react";
import { Editor, EFormat, useSlate } from "@concord-consortium/slate-editor";
import { isHighlightChipSelected } from "../../../../plugins/text/highlights-plugin";
import { isMac } from "../../../../utilities/browser";
import { IToolbarButtonComponentProps, registerTileToolbarButtons }
  from "../../../toolbar/toolbar-button-manager";
import { TileToolbarButton } from "../../../toolbar/tile-toolbar-button";
import { LinkButton } from "./link-button";
import { HighlightButton } from "./highlight-button";

import BoldToolIcon from "../../../../assets/icons/text/bold-text-icon.svg";
import ItalicToolIcon from "../../../../assets/icons/text/italic-text-icon.svg";
import UnderlineToolIcon from "../../../../assets/icons/text/underline-text-icon.svg";
import SuperscriptToolIcon from "../../../../assets/icons/text/superscript-text-icon.svg";
import SubscriptToolIcon from "../../../../assets/icons/text/subscript-text-icon.svg";
import NumberedListToolIcon from "../../../../assets/icons/text/numbered-list-text-icon.svg";
import BulletedListToolIcon from "../../../../assets/icons/text/bulleted-list-text-icon.svg";

const kShortcutPrefix = isMac() ? "Cmd-" : "Ctrl-";

const toggleMark =
  (editor: Editor, format: EFormat) => editor.toggleMark(format);
const toggleSupSub =
  (editor: Editor, format: EFormat) => editor.toggleSuperSubscript(format as EFormat.subscript | EFormat.superscript);
const toggleElement =
  (editor: Editor, format: EFormat) => editor.toggleElement(format);

interface IGenericTextToolbarButtonProps {
  name: string;
  title: string;
  keyHint?: string;
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  slateType: EFormat;
  toggleFunc: (editor: Editor, format: EFormat) => void;
}

function GenericTextToolbarButton({name, title, keyHint, Icon, slateType, toggleFunc}: IGenericTextToolbarButtonProps) {
  const editor = useSlate();
  const chipSelected = isHighlightChipSelected(editor);
  const selected = editor.isMarkActive(slateType) || editor.isElementActive(slateType);
  const disabled = chipSelected;

  function handleClick (e : React.MouseEvent) {
    e.stopPropagation();
    toggleFunc(editor, slateType);
  }
  return (
    <TileToolbarButton name={name} title={title} keyHint={keyHint}
      selected={selected} onClick={handleClick} disabled={disabled}>
      <Icon/>
    </TileToolbarButton>);
}

function BoldToolbarButton({name}: IToolbarButtonComponentProps) {
  return <GenericTextToolbarButton
    name={name} title="Bold" keyHint={kShortcutPrefix+'b'} Icon={BoldToolIcon}
    slateType={EFormat.bold} toggleFunc={toggleMark}/>;
}

function ItalicToolbarButton({name}: IToolbarButtonComponentProps) {
  return <GenericTextToolbarButton
    name={name} title="Italic" keyHint={kShortcutPrefix+'i'} Icon={ItalicToolIcon}
    slateType={EFormat.italic} toggleFunc={toggleMark}/>;
}

function UnderlineToolbarButton({name}: IToolbarButtonComponentProps) {
  return <GenericTextToolbarButton
    name={name} title="Underline" keyHint={kShortcutPrefix+'u'} Icon={UnderlineToolIcon}
    slateType={EFormat.underlined} toggleFunc={toggleMark}/>;
}

function SubscriptToolbarButton({name}: IToolbarButtonComponentProps) {
  return <GenericTextToolbarButton
    name={name} title="Subscript" Icon={SubscriptToolIcon} slateType={EFormat.subscript} toggleFunc={toggleSupSub}/>;
}

function SuperscriptToolbarButton({name}: IToolbarButtonComponentProps) {
  return <GenericTextToolbarButton
    name={name} title="Superscript" Icon={SuperscriptToolIcon}
    slateType={EFormat.superscript} toggleFunc={toggleSupSub}/>;
}

function NumberedListToolbarButton({name}: IToolbarButtonComponentProps) {
  return <GenericTextToolbarButton
    name={name} title="Numbered list" Icon={NumberedListToolIcon}
    slateType={EFormat.numberedList} toggleFunc={toggleElement}/>;
}

function BulletedListToolbarButton({name}: IToolbarButtonComponentProps) {
  return <GenericTextToolbarButton
    name={name} title="Bulleted list" Icon={BulletedListToolIcon}
    slateType={EFormat.bulletedList} toggleFunc={toggleElement}/>;
}

registerTileToolbarButtons('text',
[
  {
    name: 'bold',
    component: BoldToolbarButton,
  },
  {
    name: 'italic',
    component: ItalicToolbarButton,
  },
  {
    name: 'underline',
    component: UnderlineToolbarButton,
  },
  {
    name: 'highlight',
    component: HighlightButton,
  },
  {
    name: 'subscript',
    component: SubscriptToolbarButton,
  },
  {
    name: 'superscript',
    component: SuperscriptToolbarButton,
  },
  {
    name: 'list-ol',
    component: NumberedListToolbarButton,
  },
  {
    name: 'list-ul',
    component: BulletedListToolbarButton,
  },
  {
    name: 'link',
    component: LinkButton,
  }
]);
