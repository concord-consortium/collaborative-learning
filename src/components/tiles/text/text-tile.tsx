import React from "react";
import classNames from "classnames";
import { IReactionDisposer, observable, reaction, runInAction } from "mobx";
import { observer, inject } from "mobx-react";
import {
  createEditor, defaultHotkeyMap, Editor, EditorValue, normalizeSelection, ReactEditor, Slate, SlateEditor
} from "@concord-consortium/slate-editor";
import { TextContentModelContext } from "./text-content-context";
import { BaseComponent } from "../../base";
import { OffsetModel } from "../../../models/annotations/clue-object";
import { userSelectTile } from "../../../models/stores/ui";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { kTextTileType, TextContentModelType } from "../../../models/tiles/text/text-content";
import { HighlightRegistryContext, HighlightRevisionContext, IHighlightBox }
    from "./plugins/highlight-registry-context";
import { removeAnnotationsForChip } from "./plugins/chip-annotation-cleanup";
import { kHighlightFormat } from "./plugins/highlights-plugin";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { ITileApi, TileResizeEntry } from "../tile-api";
import { ClueTileAccessibilityBridge } from "../../../hooks/use-clue-accessibility";
import { ITileProps } from "../tile-component";
import { BasicEditableTileTitle } from "../basic-editable-tile-title";
import { getDocumentContentFromNode } from "../../../utilities/mst-utils";
import { createTextPluginInstances, ITextPlugin } from "../../../models/tiles/text/text-plugin-info";
import { LogEventName } from "../../../lib/logger-types";
import { TextPluginsContext } from "./text-plugins-context";
import { TileToolbar } from "../../toolbar/tile-toolbar";
import { countWords } from "../../../utilities/string-utils";
import { ContainerContext } from "../../document/container-context";
import { ITextTileToolbarContext, TextTileToolbarContext } from "./text-toolbar-context";
import { VoiceTypingOverlay } from "../../../utilities/voice-typing-overlay";

import "./toolbar/text-toolbar-registration";
import "./text-tile.scss";

// Returns the ids of all highlight chip elements in a Slate value.
function collectHighlightIds(value: EditorValue): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: readonly any[]) => {
    for (const node of nodes) {
      if (node?.type === kHighlightFormat && typeof node.highlightId === "string") {
        ids.add(node.highlightId);
      }
      if (Array.isArray(node?.children)) walk(node.children);
    }
  };
  walk(value as any);
  return ids;
}

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
  voiceTypingActive?: boolean;
  interimText?: string;
}

@inject("stores")
@observer
export default class TextToolComponent extends BaseComponent<ITileProps, IState> {
  public state: IState = { revision: 0 };
  private disposers: IReactionDisposer[];
  private textTileDiv: HTMLElement | null;
  private editor: Editor | undefined;
  private toolbarTileApi: ITileApi | undefined;
  private textOnFocus: string | string [] | undefined;
  private isHandlingUserChange = false;
  private highlightBoxesCache: Map<string, IHighlightBox> = new Map();
  private chipBoxesCacheTick = observable({ count: 0 });

  static contextType = ContainerContext;
  declare context: React.ContextType<typeof ContainerContext>;

  // plugins are exposed to making testing easier
  plugins: Record<string, ITextPlugin|undefined>;

  private textTileToolbarContext: ITextTileToolbarContext = {
    voiceTypingActive: false,
    setVoiceTypingActive: (active: boolean) => {
      this.textTileToolbarContext = { ...this.textTileToolbarContext, voiceTypingActive: active };
      this.setState({ voiceTypingActive: active });
    },
    interimText: "",
    setInterimText: (text: string) => {
      this.textTileToolbarContext = { ...this.textTileToolbarContext, interimText: text };
      this.setState({ interimText: text });
    },
  };

  public componentDidMount() {
    this.ensureTextTitle();
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
    const initialValue = this.getContent().asSlate();
    this.setState({ initialValue });
    // Give plugins access to stores + tileId (for cleanup hooks) and let them seed any
    // initial-value state (e.g., the variables plugin's `previousVariableIds` baseline).
    for (const plugin of Object.values(this.plugins)) {
      plugin?.setTileContext?.(this.stores, this.props.model.id);
      plugin?.initializeFromValue?.(initialValue);
    }

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

    // Tile API registration (including getFocusableElements) is now handled
    // by the ClueTileAccessibilityBridge rendered in render().
  }

  public componentWillUnmount() {
    this.disposers.forEach(disposer => disposer());
    for (const plugin of Object.values(this.plugins)) {
      plugin?.dispose?.();
    }
  }

  // --- Accessibility bridge helpers ---

  private getSlateContentElement = (): HTMLElement | undefined => {
    const el = this.textTileDiv?.querySelector("[data-slate-editor]");
    return el instanceof HTMLElement ? el : undefined;
  };

  private focusSlateContent = (): boolean => {
    if (this.editor) {
      const contentElement = this.getSlateContentElement();
      ReactEditor.focus(this.editor);
      // ReactEditor.focus doesn't create a selection if the editor never had one.
      // Without a selection, keyboard input has no insertion point and is silently ignored.
      if (!this.editor.selection) {
        const end = Editor.end(this.editor, []);
        this.editor.selection = { anchor: end, focus: end };
      }
      return document.activeElement === contentElement;
    }
    return false;
  };

  private additionalTileApi: Partial<ITileApi> = {
    exportContentAsTileJson: () => {
      return this.getContent().exportJson();
    },
    handleDocumentScroll: (x: number, y: number) => {
      this.toolbarTileApi?.handleDocumentScroll?.(x, y);
    },
    handleTileResize: (entry: TileResizeEntry) => {
      this.toolbarTileApi?.handleTileResize?.(entry);
    },
    getObjectBoundingBox: (objectId: string, objectType?: string) => {
      // Track the tick so MobX observers re-run when the cache is written.
      // eslint-disable-next-line unused-imports/no-unused-vars
      const _tick = this.chipBoxesCacheTick.count;
      if (objectType === kHighlightFormat) {
        return this.highlightBoxesCache.get(objectId);
      }
      // Other chip kinds (e.g., variable chips) live in their plugin's bbox cache.
      for (const plugin of Object.values(this.plugins)) {
        const box = plugin?.getObjectBoundingBox?.(objectId, objectType);
        if (box) return box;
      }
      return undefined;
    },
    getObjectDefaultOffsets: (objectId: string, objectType?: string) => {
      // offset the annotation arrows to the right top corner of the bounding box until connected to a target,
      // and then offset should be the center of the edge closes to the target
      // Track the tick so MobX observers re-run when the cache is written.
      // eslint-disable-next-line unused-imports/no-unused-vars
      const _tick = this.chipBoxesCacheTick.count;
      if (objectType === kHighlightFormat) {
        const offsets = OffsetModel.create({});
        const box = this.highlightBoxesCache.get(objectId);
        if (box) {
          offsets.setDx(box.width / 2);
          offsets.setDy(-box.height / 2);
        }
        return offsets;
      }
      for (const plugin of Object.values(this.plugins)) {
        const offsets = plugin?.getObjectDefaultOffsets?.(objectId, objectType);
        if (offsets) return offsets;
      }
      return OffsetModel.create({});
    },
  };

  public render() {
    const { appConfig: { placeholderText } } = this.stores;
    const readOnly = this.isReadOnly();

    const editableClass = readOnly ? "read-only" : "editable";
    const showTitle = !!this.stores.appConfig.showTextTitles;
    const containerClasses = classNames("tile-content", "text-tool-wrapper", {
      editable: !readOnly,
      hovered: this.props.hovered,
      selected: this.stores.ui.isSelectedTile(this.props.model),
      "voice-typing-active": this.state.voiceTypingActive,
      "show-title": showTitle,
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
      <TextTileToolbarContext.Provider value={this.textTileToolbarContext}>
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
                  <ClueTileAccessibilityBridge
                    onRegisterTileApi={this.props.onRegisterTileApi}
                    onUnregisterTileApi={this.props.onUnregisterTileApi}
                    tileType="text"
                    getContentElement={this.getSlateContentElement}
                    focusContent={this.focusSlateContent}
                    additionalApi={this.additionalTileApi}
                  />
                  {showTitle && <div className="text-tile-title"><BasicEditableTileTitle /></div>}
                  <Slate
                    editor={this.editor as ReactEditor}
                    initialValue={this.state.initialValue}
                    onValueChange={this.handleChange}
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
                  <VoiceTypingOverlay
                    text={this.state.interimText || ""}
                    tileElement={this.textTileDiv}
                  />
                </div>
              </HighlightRegistryContext.Provider>
            </HighlightRevisionContext.Provider>
          </TextPluginsContext.Provider>
        </TextContentModelContext.Provider>
      </TextTileToolbarContext.Provider>
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
      // Cascade-clean any highlight chip the user edited out: remove sparrows attached
      // to it, prune the highlightedText MST entry, and clear its bbox cache.
      const previousHighlightIds = content.highlightedText.map(h => h.id);
      const currentHighlightIds = collectHighlightIds(value);
      const removedHighlightIds = previousHighlightIds.filter(id => !currentHighlightIds.has(id));

      // Update content model when user changes slate
      content.setSlate(value);

      for (const id of removedHighlightIds) {
        removeAnnotationsForChip(this.stores, model.id, id, kHighlightFormat);
        content.removeHighlight(id);
        this.updateBoxCache(this.highlightBoxesCache, id, undefined);
      }
      // Other chip kinds (e.g., variable chips) handle their own diff/cleanup inside
      // their plugin's handleSlateValueChange hook.
      for (const plugin of Object.values(this.plugins)) {
        plugin?.handleSlateValueChange?.(value);
      }

      this.setState({ revision: this.state.revision + 1 });
      this.isHandlingUserChange = false;
    }
  };

  private handleMouseDownInWrapper = (e: React.MouseEvent<HTMLDivElement>) => {
    const { ui } = this.stores;
    const { model } = this.props;
    const readOnly = this.isReadOnly();
    const inLockedContainer = this.context.isLocked;

    // Don't select a locked prompt in editable mode (it shouldn't be editable).
    // In read-only mode, select the container (question tile) so the prompt
    // acts as a proxy for commenting on the question.
    if (this.props.model.fixedPosition && inLockedContainer) {
      if (readOnly && this.context.model) {
        ui.setSelectedTile(this.context.model, { append: hasSelectionModifier(e) });
      }
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

  // Text tiles created via addTile already receive an auto-numbered title; this backfills a
  // default for legacy tiles that predate that (or were authored without one) so they display a
  // sensible name when the unit shows text-tile titles. Guarded to editable tiles so we never
  // mutate read-only/curriculum documents.
  private ensureTextTitle() {
    if (!this.stores.appConfig.showTextTitles) return;
    if (this.isReadOnly()) return;
    const { model } = this.props;
    if (model.title) return;
    const title = getDocumentContentFromNode(model)?.getUniqueTitleForType(kTextTileType);
    if (title) model.setTitle(title);
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

  // Skips the tick bump if the value hasn't actually changed, so a no-op ResizeObserver
  // fire doesn't wake up downstream observers (e.g. AnnotationLayer's render).
  private updateBoxCache(cache: Map<string, IHighlightBox>, id: string, box: IHighlightBox | undefined) {
    const existing = cache.get(id);
    if (box) {
      if (existing && existing.left === box.left && existing.top === box.top
          && existing.width === box.width && existing.height === box.height) return;
      cache.set(id, box);
    } else {
      if (!existing) return;
      cache.delete(id);
    }
    runInAction(() => { this.chipBoxesCacheTick.count++; });
  }

  private handleUpdateHighlightBoxCache = (id: string, box: IHighlightBox) => {
    this.updateBoxCache(this.highlightBoxesCache, id, box);
  };
}
