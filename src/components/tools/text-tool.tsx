import * as React from "react";
import { observer, inject } from "mobx-react";
import { Operation, Value } from "slate";
import { Editor } from "slate-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { TextContentModelType } from "../../models/tools/text/text-content";
import * as Immutable from "immutable";
import { autorun, IReactionDisposer } from "mobx";

interface SlateChange {
  operations: Immutable.List<Operation>;
  value: Value;
}

import "./text-tool.sass";

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  value?: Value;
}
​
@inject("stores")
@observer
export default class TextToolComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};
  private disposers: IReactionDisposer[];
  private prevText: any;

  public onChange = (change: SlateChange) => {
    const { readOnly, model } = this.props;
    const { content } = model;
    const { ui } = this.stores;

    // determine last focus state from list of operations
    let isFocused: boolean | undefined;
    change.operations.forEach(op => {
      if (op && op.type === "set_selection") {
        isFocused = op.selection.get("isFocused");
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

        // The state will have updated in response to the content change, but the content loses the cursor position
        // So, we update here using the raw change, which still contains the cursor position
        this.setState({ value: change.value });
      }
    }
  }

  public componentDidMount() {
    const initialTextContent = this.props.model.content as TextContentModelType;
    this.prevText = initialTextContent.text;
    const initialValue = initialTextContent.convertSlate();
    this.setState({
      value: initialValue
    });

    this.disposers = [];
    this.disposers.push(autorun(() => {
      const textContent = this.props.model.content as TextContentModelType;
      if (this.prevText !== textContent.text) {
        const newValue = textContent.convertSlate(this.state.value);
        this.setState({
          value: newValue
        });
        this.prevText = textContent.text;
      }
    }));
  }

  public componentWillUnmount() {
    this.disposers.forEach(disposer => disposer());
  }

  public render() {
    const { model, readOnly } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `text-tool ${editableClass}`;
    if (!this.state.value) { return null; }
    return (
      <Editor
        key={model.id}
        className={classes}
        readOnly={readOnly}
        value={this.state.value}
        onChange={this.onChange}
      />
    );
  }
}
