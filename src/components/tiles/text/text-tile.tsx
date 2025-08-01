import React from "react";
import classNames from "classnames";
import { IReactionDisposer, reaction } from "mobx";
import { observer, inject } from "mobx-react";
import {
  createEditor, defaultHotkeyMap, Editor, EditorValue, normalizeSelection, ReactEditor, Slate, SlateEditor
} from "@concord-consortium/slate-editor";
import { TextContentModelContext } from "./text-content-context";
import { BaseComponent } from "../../base";
import { OffsetModel } from "../../../models/annotations/clue-object";
import { userSelectTile } from "../../../models/stores/ui";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { TextContentModelType } from "../../../models/tiles/text/text-content";
import { HighlightRegistryContext, HighlightRevisionContext, IHighlightBox }
    from "../../../plugins/text/highlight-registry-context";
import { kHighlightFormat } from "../../../plugins/text/highlights-plugin";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { ITileApi, TileResizeEntry } from "../tile-api";
import { ITileProps } from "../tile-component";
import { createTextPluginInstances, ITextPlugin } from "../../../models/tiles/text/text-plugin-info";
import { LogEventName } from "../../../lib/logger-types";
import { TextPluginsContext } from "./text-plugins-context";
import { TileToolbar } from "../../toolbar/tile-toolbar";
import { countWords } from "../../../utilities/string-utils";
import { ContainerContext } from "../../document/container-context";

import "./toolbar/text-toolbar-registration";
import "./text-tile.scss";

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
  initialValue?: EditorValue;
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

  static contextType = ContainerContext;
  declare context: React.ContextType<typeof ContainerContext>;

  // plugins are exposed to making testing easier
  plugins: Record<string, ITextPlugin|undefined>;

  public componentDidMount() {
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
    this.setState({ initialValue: this.getContent().asSlate() });

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
      },
      getObjectBoundingBox: (objectId: string, objectType?: string) => {
        if (objectType === kHighlightFormat) {
          const box = this.getContent().highlightBoxesCache.get(objectId);
          if (box) return box;
        }
      },
      getObjectDefaultOffsets: (objectId: string, objectType?: string) => {
        // offset the annotation arrows to the right top corner of the bounding box until connected to a target,
        // and then offset should be the center of the edge closes to the target
        const offsets = OffsetModel.create({});
        if (objectType === kHighlightFormat) {
          const box = this.getContent().highlightBoxesCache.get(objectId);
          if (box) {
            const { width, height } = box;
            offsets.setDx(width / 2);
            offsets.setDy(- height / 2);
          }
        }
        return offsets;
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
    const { appConfig: { placeholderText } } = this.stores;
    const readOnly = this.isReadOnly();

    const editableClass = readOnly ? "read-only" : "editable";
    const containerClasses = classNames("tile-content", "text-tool-wrapper", {
      editable: !readOnly,
      hovered: this.props.hovered,
      selected: this.stores.ui.isSelectedTile(this.props.model),
    });
    // Ideally this would just be 'text-tool-editor', but 'text-tool' has been
    // used here for a while now and cypress tests depend on it. Should transition
    // to using 'text-tool-editor' for these purposes moving forward.
    const slateClasses = `text-tool text-tool-editor ${editableClass}`;
    if (!this.state.initialValue) return null;

    return (
      // Ideally, this would just be 'text-tool' for consistency with other tools,
      // but 'text-tool` is used for the internal editor (cf. 'classes' above),
      // which is used for cypress tests and other purposes.
      // TODO: replace this provider with one at the tile level so we get it for free.
      // and then replace the drawing one with that as well
      <TextContentModelContext.Provider value={this.getContent()} >
        <TextPluginsContext.Provider value={this.plugins} >
          <HighlightRevisionContext.Provider value={this.state.revision}>
            <HighlightRegistryContext.Provider value={this.handleUpdateHighlightBoxCache}>
              <div
                className={containerClasses}
                data-testid="text-tool-wrapper"
                ref={elt => this.textTileDiv = elt}
                onMouseDown={this.handleMouseDownInWrapper}
              >
                <Slate
                  editor={this.editor as ReactEditor}
                  initialValue={this.state.initialValue}
                  onChange={this.handleChange}
                >
                  <SlateEditor
                    placeholder={placeholderText}
                    hotkeyMap={defaultHotkeyMap}
                    readOnly={readOnly}
                    onFocus={this.handleFocus}
                    onBlur={this.handleBlur}
                    className={`ccrte-editor slate-editor ${slateClasses || ""}`}
                  />
                  <TileToolbar tileType="text" tileElement={this.props.tileElt} readOnly={!!readOnly} />
                </Slate>
              </div>
            </HighlightRegistryContext.Provider>
          </HighlightRevisionContext.Provider>
        </TextPluginsContext.Provider>
      </TextContentModelContext.Provider>
    );
  }

  private handleChange = (value: EditorValue) => {
    const { model } = this.props;
    const content = this.getContent();
    const { ui } = this.stores;
    const readOnly = this.isReadOnly();

    if (this.editor && ReactEditor.isFocused(this.editor)) {
      userSelectTile(ui, model, { readOnly, container: this.context.model });
    }

    if (!readOnly) {
      this.isHandlingUserChange = true;
      // Update content model when user changes slate
      content.setSlate(value);
      this.setState({ revision: this.state.revision + 1 });
      this.isHandlingUserChange = false;
    }
  };

  private handleMouseDownInWrapper = (e: React.MouseEvent<HTMLDivElement>) => {
    const { ui } = this.stores;
    const { model } = this.props;
    const readOnly = this.isReadOnly();
    const inLockedContainer = this.context.isLocked;

    // Don't select a locked prompt
    if (this.props.model.fixedPosition && inLockedContainer) {
      return;
    }

    const append = hasSelectionModifier(e);
    const isWrapperClick = e.target === this.textTileDiv;
    userSelectTile(ui, model, { readOnly, append, container: this.context.model });

    if (isWrapperClick || append) {
      if (readOnly) {
        // In read-only mode, just prevent the default to avoid Slate's auto-select
        // but don't stop propagation to allow text selection to work
        e.preventDefault();
      } else if (isWrapperClick) {
        // In editable mode, focus the editor for wrapper clicks
        this.editor && ReactEditor.focus(this.editor);
        e.preventDefault();
      }
    }
  };

  private getContent() {
    return this.props.model.content as TextContentModelType;
  }

  private isReadOnly(): boolean {
    const inLockedContainer = this.context.isLocked;
    const isFixedInLockedContainer = this.props.model.fixedPosition && inLockedContainer;
    const isReadOnly = this.props.readOnly || isFixedInLockedContainer;

    return isReadOnly;
  }


  private handleBlur = () => {
    const readOnly = this.isReadOnly();

    if (!readOnly) {
      // If the text has changed since the editor was focused, log the new text.
      const text = this.getContent().text;
      if (text !== this.textOnFocus) {
        const plainText = this.getContent().asPlainText();
        const wordCount = countWords(plainText);
        const change = {args:[{ text }]};
        logTileChangeEvent(LogEventName.TEXT_TOOL_CHANGE, {
          operation: 'update',
          change,
          plainText,
          wordCount,
          tileId: this.props.model.id });
      }

      this.setState({ revision: this.state.revision + 1 }); // Force a rerender
    }
  };

  private handleFocus = () => {
    const readOnly = this.isReadOnly();

    if (!readOnly) {
      this.textOnFocus = this.getContent().textStr;
    }
    this.setState({ revision: this.state.revision + 1 }); // Force a rerender
  };

  private handleUpdateHighlightBoxCache = (id: string, box: IHighlightBox) => {
    this.getContent().setHighlightBoxesCache(id, box);
  };
}
