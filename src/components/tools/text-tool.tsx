import * as Immutable from "immutable";
import * as React from "react";
import { observer, inject } from "mobx-react";
import { Operation, Value } from "slate";
import { Editor, Plugin } from "slate-react";
import { isHotkey } from "is-hotkey";

import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { TextContentModelType } from "../../models/tools/text/text-content";
import { autorun, IReactionDisposer } from "mobx";

import "./text-tool.sass";

interface SlateChange {
  operations: Immutable.List<Operation>;
  value: Value;
}

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  value?: Value;
}
​
enum ESlateType {
  mark = "mark",
  block = "block"
}

interface IOnKeyDownHandlerDef {
  slateType: ESlateType;
  key: string;
  type: string;
}

function BulletItem(props: any) {
  return (
    <ul {...props.attributes}>{props.children}</ul>
  );
}

function NumberedItem(props: any) {
  return (
    <ol {...props.attributes}>{props.children}</ol>
  );
}

function Typewriter(props: any) {
  const { children, attributes } = props;
  return (
    <code {...attributes}>{children}</code>
  );
}

function Button(props: any) {
  const { active, reversed} = props;
  return (<span className={"floating-text-tool-button"} />);
}

@inject("stores")
@observer
export default class TextToolComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};
  private disposers: IReactionDisposer[];
  private prevText: any;

  private plugins: Plugin[] = [
    this.makeOnKeyDownHandler({ slateType: ESlateType.mark,  key: "mod+b",       type: "bold" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.mark,  key: "mod+i",       type: "italic" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.mark,  key: "mod+u",       type: "underline" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.mark,  key: "mod+s",       type: "superscript" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.mark,  key: "mod+shift+s", type: "subscript" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.mark,  key: "ctrl+t",      type: "typewriter" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.block, key: "ctrl+b",      type: "bulleted" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.block, key: "ctrl+n",      type: "numbered" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.block, key: "ctrl+1",      type: "header-1" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.block, key: "ctrl+2",      type: "header-2" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.block, key: "ctrl+3",      type: "header-3" }),
  ];

  public onChange = (change: SlateChange) => {
    const { readOnly, model } = this.props;
    const content = this.getContent();
    const { ui } = this.stores;

    // determine last focus state from list of operations
    let isFocused: boolean | undefined;
    change.operations.forEach(op => {
      if (op && op.type === "set_selection") {
        isFocused = op.properties.isFocused;
      }
    });

    if (isFocused != null) {
      // polarity is reversed from what one might expect
      if (!isFocused) {
        // only select - if we deselect, it breaks delete because Slate
        // somehow detects the selection change before the click on the
        // delete button is processed by the workspace. For now, we just
        // disable focus change on deselection.
        ui.setSelectedTile(model);
      }
    }

    if (content.type === "Text") {
      if (!readOnly) {
          content.setSlate(change.value);
          this.setState({ value: change.value });
      }
    }
  }

  public componentDidMount() {
    const initialTextContent = this.props.model.content as TextContentModelType;
    this.prevText = initialTextContent.text;
    const initialValue = initialTextContent.asSlate();
    this.setState({
      value: initialValue
    });

    this.disposers = [];
    if (this.props.readOnly) {
      this.disposers.push(autorun(() => {
        const textContent = this.props.model.content as TextContentModelType;
        if (this.prevText !== textContent.text) {
          this.setState({ value: textContent.asSlate() });
          this.prevText = textContent.text;
        }
      }));
    }
  }

  public componentWillUnmount() {
    this.disposers.forEach(disposer => disposer());
  }

  public render() {
    const { model, readOnly } = this.props;
    const { unit: { placeholderText } } = this.stores;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `text-tool ${editableClass}`;

    const onButtonPress = () => {
      // tslint:disable-next-line
      console.log("Hey, look, no hands!");
    };

    if (!this.state.value) { return null; }
    return (
      <div>
        <Editor
          plugins={this.plugins}
          key={model.id}
          className={classes}
          placeholder={placeholderText}
          readOnly={readOnly}
          value={this.state.value}
          onChange={this.onChange}
          renderMark={this.renderMark}
          renderBlock={this.renderBlock}
        />
        {/* <EditorStyleBar
          onButtonPress={onButtonPress}
          value={this.state.value}
        /> */}
      </div>
    );
  }

  private renderMark = (props: any, editor: any, next: () => any ) => {
    const { children, mark, attributes } = props;
    switch (mark.type) {
      case "bold": return (<strong{...{ attributes }}>{children}</strong>);
      case "italic": return (<em{...{ attributes }}>{children}</em>);
      case "underline": return (<u{...{ attributes }}>{children}</u>);
      case "typewriter": return (<Typewriter {...props} />);
      case "superscript": return (<sup{...{ attributes }}>{children}</sup>);
      case "subscript": return (<sub{...{ attributes }}>{children}</sub>);
      default: return next();
    }
  }

  private renderBlock = (props: any, editor: any, next: () => any ) => {
    const { children, attributes, node: {type} } = props;
    switch (type) {
      case "bulleted": return (<BulletItem {...props} />);
      case "numbered": return (<NumberedItem {...props} />);
      case "list-item": return (<li {...{attributes}}>{children}</li>);
      case "header-1": return (<h1 {...{attributes}}>{children}</h1>);
      case "header-2": return (<h2 {...{attributes}}>{children}</h2>);
      case "header-3": return (<h3 {...{attributes}}>{children}</h3>);
      default: return next();
    }
  }

  private getContent() {
    return this.props.model.content as TextContentModelType;
  }

  private makeOnKeyDownHandler(hotKeyDef: IOnKeyDownHandlerDef): Plugin {
    // Builds and returns a Slate plug-in for an onKeyDown handler.
    const { key, type, slateType } = hotKeyDef;
    switch (slateType) {
      case ESlateType.mark:
        return ({
          onKeyDown(event: any, editor: any, next: () => any) {
            if (! isHotkey(key, event)) {
              next();
            } else {
              event.preventDefault();
              switch (type) {
                case "superscript":
                case "subscript":
                  // Special case handling of supers & subs to prevent nesting.
                  const hasType = editor.value.marks.some( (m: any) => ["superscript", "subscript"].includes(m.type) );
                  if (! hasType) {
                    editor.toggleMark(type);
                  } else {
                    editor.removeMark("superscript")
                          .removeMark("subscript");
                  }
                  break;
                default:
                  // Handles everything else. E.g., bold, underline, italic, typewriter, etc.
                  editor.toggleMark(type);
                  break;
              }
            }
          }
        });
      case ESlateType.block:
        return ({
          onKeyDown(event: any, editor: any, next: () => any) {
            const DEFAULT_BLOCK_TYPE = "paragraph";
            if (! isHotkey(key, event)) {
              next();
            } else {
              event.preventDefault();
              const { value: {blocks, document} } = editor;
              const containsListItems = blocks.some((block: any) => block.type === "list-item");
              const isListOfThisType = blocks.some( (block: any) => {
                return !!document.getClosest(block.key, (parent: any) => parent.type === type);
              });
              switch (type) {
                case "bulleted":
                case "numbered":
                  // If what we are setting is not yet a list, we want to set
                  // them to list-items, and wrap them with the appropriate type of
                  // containing block.
                  if (! containsListItems) {
                    editor.setBlocks("list-item")
                          .wrapBlock(type);
                  } else {
                    if (isListOfThisType) {
                      // removes.
                      editor.setBlocks(DEFAULT_BLOCK_TYPE)
                            .unwrapBlock("bulleted")
                            .unwrapBlock("numbered");
                    } else {
                      // If we are here, then it is a list and we are trying to
                      // switch everything in the selection to that new list type,
                      // or, if we are already that type, we want to clear.
                      editor.unwrapBlock(type === "bulleted" ? "numbered" : "bulleted")
                            .wrapBlock(type);
                    }
                  }
                  break;
                case "header-1":
                case "header-2":
                case "header-3":
                default:
                  // const containsListItems = blocks.some((block: any) => block.type === "list-item");
                  const isAlreadySet = blocks.some( (block: any) => block.type === type );
                  editor.setBlocks(isAlreadySet ? DEFAULT_BLOCK_TYPE : type);
                  if (containsListItems) {
                    // In this case, we are trying to change a block away from
                    // being a list. To do this, we either set the type we are
                    // after, or clear it, if it's already set to that type. Then
                    // we remove any part of the selection that might be a wrapper
                    // of either type of list.
                    editor.unwrapBlock("bulleted")
                          .unwrapBlock("numbered");
                  }
                  break;
              }
            }
          }
        });
      default:
        return ({
          onKeyDown(event: any, editor: any, next: () => any) {
            // tslint:disable-next-line
            console.log(`Internal error: unknown Slate editor type "${slateType}"`);
          }
        });
    }
  }
}
