import React from "react";
import { IReactionDisposer, reaction } from "mobx";
import { observer, inject } from "mobx-react";
import {
  createEditor, defaultHotkeyMap, Editor, EditorValue, normalizeSelection, ReactEditor, Slate, SlateEditor
} from "@concord-consortium/slate-editor";
import { TextContentModelContext } from "./text-content-context";
import { BaseComponent } from "../../base";
import { debouncedSelectTile } from "../../../models/stores/ui";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { TextContentModelType } from "../../../models/tiles/text/text-content";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { TextToolbarComponent } from "./text-toolbar";
import { ITileApi, TileResizeEntry } from "../tile-api";
import { ITileProps } from "../tile-component";
import { createTextPluginInstances, ITextPlugin } from "../../../models/tiles/text/text-plugin-info";
import { LogEventName } from "../../../lib/logger-types";
import { TextPluginsContext } from "./text-plugins-context";

import "./text-tile.sass";

/*
  The Slate internal data model uses, among other things, "marks" and "blocks"
  to implement structured text. Marks are generally used for character styles
  and blocks are generally used to implement complex structures that are similar
  to the CSS-concept of "display: block", as opposed to, "display: inline".

  The following tables show the names used to distinguish the mark & block
  types within the slate model. These names have been selected to peacefully
  co-exist with the names generated when HTML and Markdown formatted text are
  converted to a slate model for presentation and editing in the text-tool.

  There are slate blocks and marks that are not mapped to any user actions in
  the editor; however, they handed by this tool (when readonly) as a way to
  render styled text in the curriculum. In other words, just because there's
  no way for a user to create a particular style in the editor, this tool may
  still need to render it. See the heading1 - heading6 slate blocks for
  example.

  Marks:

    |  Slate Name |  Markdown | HTML tag |   Hot-Key   |  Tool-Bar*  |
    |-------------|-----------|----------|-------------|-------------|
    | bold        | **xyzzy** | <strong> | CMD-b       | bold        |
    | italic      | _xyzzy_   | <em>     | CMD-i       | italic      |
    | code        | `xyzzy`   | <code>   |             | code        |
    | inserted    | ++xyzzy++ | <mark>   |             |             |
    | deleted     | ~~xyzzy~~ | <del>    |             |             |
    | underlined  | __xyzzy__ | <u>      | CMD-u       | underline   |
    | superscript |           | <sup>    | CMD-shift-, | superscript |
    | subscript   |           | <sub>    | CMD-,       | subscript   |

  Blocks:

    |   Slate Name    |   Markdown    |   HTML tag   | Tool-Bar* |
    |-----------------|---------------|--------------|-----------|
    | paragraph       |               | <p>          |           |
    | horizontal-rule | ---           | <hr>         |           |
    | heading1        | #             | <h1>         |           |
    | heading2        | ##            | <h2>         |           |
    | heading3        | ###           | <h3>         |           |
    | heading4        | ####          | <h4>         |           |
    | heading5        | #####         | <h5>         |           |
    | heading6        | ######        | <h6>         |           |
    | bulleted-list   | `* ` prefix   | <ul>         | list-ul   |
    | todo-list       | `- [ ] `      | <ul>         |           | broken
    | ordered-list    | `1. ` prefix  | <ol>         | list-ol   |
    | table           | \| & - syntax | <table>      |           | needs <tbody>
    | table-row       |               | <tr>         |           | needs <tbody>
    | table-head      |               | <th>         |           | needs <tbody>
    | table-cell      |               | <td>         |           | needs <tbody>
    | block-quote     | `> ` prefix   | <blockquote> |           |
    | image           | `![]` syntax  | <img>        |           | broken
    | link            | `[]()` syntax | <a>          |           | broken

  * The name in the Tool Bar column is used to both render the button and to
  identify the button's action.

*/

interface IState {
  revision: number;
}

@inject("stores")
@observer
export default class TextToolComponent extends BaseComponent<ITileProps, IState> {
  public state: IState = { revision: 0 };
  private disposers: IReactionDisposer[];
  private textTileDiv: HTMLElement | null;
  private editor: Editor | undefined;
  private tileContentRect: DOMRectReadOnly;
  private toolbarTileApi: ITileApi | undefined;
  private textOnFocus: string | string [] | undefined;
  private isHandlingUserChange = false;
  private initialValue: EditorValue;

  // plugins are exposed to making testing easier
  plugins: Record<string, ITextPlugin|undefined>;

  public componentDidMount() {
    this.initialValue = this.getContent().asSlate();
    this.plugins = createTextPluginInstances(this.props.model.content as TextContentModelType);
    const options: any = {}; // FIXME: type. ICreateEditorOptions is not currently exported from slate
    // Gather all the plugin init functions and pass that to slate.
    const onInitEditor = (e: Editor) => {
      Object.values(this.plugins).forEach(plugin => {
        if (plugin?.onInitEditor) {
          e = plugin.onInitEditor(e);
        }
      });
      return e;
    };
    options.onInitEditor = onInitEditor;
    options.history = false;
    this.editor = createEditor(options);
    this.getContent().setEditor(this.editor);

    this.disposers = [];
    // Synchronize slate with model changes. e.g. changes to any text in another tile is refelected here.
    this.disposers.push(reaction(
      () => this.getContent().text,
      () => {
        // Update slate when content model changes
        if (!this.isHandlingUserChange) {
          const textContent = this.getContent();
          if (this.editor) {
            this.editor.children = textContent.asSlate();
            normalizeSelection(this.editor);
            this.setState({ revision: this.state.revision + 1 }); // Force a rerender
          }
        }
      }
    ));
    // blur editor when tile is deselected
    this.disposers.push(reaction(
      () => {
        const { model: { id } } = this.props;
        const { ui: { selectedTileIds } } = this.stores;
        return selectedTileIds.includes(id);
      },
      isTileSelected => {
        const isFocused = this.editor && ReactEditor.isFocused(this.editor);
        if (isFocused && !isTileSelected) {
          this.editor && ReactEditor.blur(this.editor);
        }
      }
    ));

    this.props.onRegisterTileApi({
      exportContentAsTileJson: () => {
        return this.getContent().exportJson();
      },
      handleDocumentScroll: (x: number, y: number) => {
        this.toolbarTileApi?.handleDocumentScroll?.(x, y);
      },
      handleTileResize: (entry: TileResizeEntry) => {
        const { x, y, width, height, top, left, bottom, right } = entry.contentRect;
        this.tileContentRect = { x, y, width, height, top, left, bottom, right, toJSON: () => "" };
        this.toolbarTileApi?.handleTileResize?.(entry);
      }
    });

  }

  public componentWillUnmount() {
    this.disposers.forEach(disposer => disposer());
    for (const plugin of Object.values(this.plugins)) {
      plugin?.dispose?.();
    }
  }

  public render() {
    const { documentContent, tileElt, readOnly, scale } = this.props;
    const { appConfig: { placeholderText } } = this.stores;
    const editableClass = readOnly ? "read-only" : "editable";
    // Ideally this would just be 'text-tool-editor', but 'text-tool' has been
    // used here for a while now and cypress tests depend on it. Should transition
    // to using 'text-tool-editor' for these purposes moving forward.
    const classes = `text-tool text-tool-editor ${editableClass}`;
    if (!this.initialValue) return null;

    return (
      // Ideally, this would just be 'text-tool' for consistency with other tools,
      // but 'text-tool` is used for the internal editor (cf. 'classes' above),
      // which is used for cypress tests and other purposes.
      // TODO: replace this provider with one at the tile level so we get it for free.
      // and then replace the drawing one with that as well
      <TextContentModelContext.Provider value={this.getContent()} >
        <TextPluginsContext.Provider value={this.plugins} >
          <div className={`text-tool-wrapper ${readOnly ? "" : "editable"}`}
            data-testid="text-tool-wrapper"
            ref={elt => this.textTileDiv = elt}
            onMouseDown={this.handleMouseDownInWrapper}
          >
            <Slate
              editor={this.editor as ReactEditor}
              value={this.initialValue}
              onChange={this.handleChange}
            >
              <SlateEditor
                placeholder={placeholderText}
                hotkeyMap={defaultHotkeyMap}
                readOnly={readOnly}
                onFocus={this.handleFocus}
                onBlur={this.handleBlur}
                className={`ccrte-editor slate-editor ${classes || ""}`}
              />
              <TextToolbarComponent
                documentContent={documentContent}
                tileElt={tileElt}
                scale={scale}
                onIsEnabled={this.handleIsEnabled}
                onRegisterTileApi={this.handleRegisterToolApi}
                onUnregisterTileApi={this.handleUnregisterToolApi}
              />
            </Slate>
          </div>
        </TextPluginsContext.Provider>
      </TextContentModelContext.Provider>
    );
  }

  private handleRegisterToolApi = (tileApi: ITileApi) => {
    this.toolbarTileApi = tileApi;

    // call resize handler immediately with current size
    const { tileElt } = this.props;
    tileElt && this.tileContentRect &&
      this.toolbarTileApi?.handleTileResize?.({ target: tileElt, contentRect: this.tileContentRect });
  };

  private handleUnregisterToolApi = () => {
    this.toolbarTileApi = undefined;
  };

  private handleIsEnabled = () => {
    // text toolbar is based on editor focus rather than tile selection
    return ReactEditor.isFocused(this.editor as ReactEditor);
  };

  private handleChange = (value: EditorValue) => {
    const { model } = this.props;
    const content = this.getContent();
    const { ui } = this.stores;

    if (this.editor && ReactEditor.isFocused(this.editor)) {
      debouncedSelectTile(ui, model);
    }

    this.isHandlingUserChange = true;
    // Update content model when user changes slate
    content.setSlate(value);
    this.isHandlingUserChange = false;
  };

  private handleMouseDownInWrapper = (e: React.MouseEvent<HTMLDivElement>) => {
    const { ui } = this.stores;
    const { model, readOnly } = this.props;
    const isExtendingSelection = hasSelectionModifier(e);
    const isWrapperClick = e.target === this.textTileDiv;
    if (readOnly || isWrapperClick || isExtendingSelection) {
      isWrapperClick && this.editor && ReactEditor.focus(this.editor);
      ui.setSelectedTile(model, { append: isExtendingSelection });
      e.preventDefault();
    }
  };

  private getContent() {
    return this.props.model.content as TextContentModelType;
  }

  private handleBlur = () => {
    // If the text has changed since the editor was focused, log the new text.
    const text = this.getContent().text;
    if (text !== this.textOnFocus) {
      const change = {args:[{ text }]};
      logTileChangeEvent(LogEventName.TEXT_TOOL_CHANGE, { operation: 'update', change, tileId: this.props.model.id });
    }
  };

  private handleFocus = () => {
    this.textOnFocus = this.getContent().text;
  };
}
