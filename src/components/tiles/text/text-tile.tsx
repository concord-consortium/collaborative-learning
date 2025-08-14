import React, { useState, useEffect, useRef, useCallback } from "react";
import classNames from "classnames";
import { IReactionDisposer, reaction } from "mobx";
import { observer } from "mobx-react";
import {
  createEditor, defaultHotkeyMap, Editor, EditorValue, normalizeSelection, ReactEditor, Slate, SlateEditor
} from "@concord-consortium/slate-editor";
import { TextContentModelContext } from "./text-content-context";
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
import { useStores } from "../../../hooks/use-stores";
import { useContainerContext } from "../../document/container-context";

import "./toolbar/text-toolbar-registration";
import "./text-tile.scss";
import { useFirebaseFunction } from "../../../hooks/use-firebase-function";
import { IGetCustomizedExemplarUnionParams } from "../../../../shared/shared";
import { useUserContext } from "../../../hooks/use-user-context";

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

export const TextToolComponent = observer(function TextToolComponent(props: ITileProps) {
  const stores = useStores();
  const containerContext = useContainerContext();

  const [state, setState] = useState<IState>({ revision: 0 });
  const [initialValue, setInitialValue] = useState<EditorValue | undefined>(undefined);

  const textTileDivRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | undefined>(undefined);
  const tileContentRectRef = useRef<DOMRectReadOnly | null>(null);
  const toolbarTileApiRef = useRef<ITileApi | undefined>(undefined);
  const textOnFocusRef = useRef<string | string[] | undefined>(undefined);
  const isHandlingUserChangeRef = useRef(false);
  const disposersRef = useRef<IReactionDisposer[]>([]);
  const pluginsRef = useRef<Record<string, ITextPlugin|undefined>>({});

  const context = useUserContext();
  const getCustomizedExemplar = useFirebaseFunction<IGetCustomizedExemplarUnionParams>("getCustomizedExemplar_v2");

  // plugins are exposed to making testing easier
  const plugins = pluginsRef.current;

  const getContent = useCallback(() => {
    return props.model.content as TextContentModelType;
  }, [props.model.content]);

  const isReadOnly = useCallback((): boolean => {
    const inLockedContainer = containerContext.isLocked;
    const isFixedInLockedContainer = props.model.fixedPosition && inLockedContainer;
    const readOnlyValue = props.readOnly || isFixedInLockedContainer;

    return readOnlyValue;
  }, [containerContext.isLocked, props.model.fixedPosition, props.readOnly]);

  const handleUpdateHighlightBoxCache = useCallback((id: string, box: IHighlightBox) => {
    getContent().setHighlightBoxesCache(id, box);
  }, [getContent]);

  const handleChange = useCallback((value: EditorValue) => {
    const { model } = props;
    const content = getContent();
    const { ui } = stores;
    const readOnlyValue = isReadOnly();

    if (editorRef.current && ReactEditor.isFocused(editorRef.current)) {
      userSelectTile(ui, model, { readOnly: readOnlyValue, container: containerContext.model });
    }

    if (!readOnlyValue) {
      isHandlingUserChangeRef.current = true;
      // Update content model when user changes slate
      content.setSlate(value);
      setState(prev => ({ ...prev, revision: prev.revision + 1 }));
      isHandlingUserChangeRef.current = false;
    }
  }, [props, getContent, stores, isReadOnly, containerContext.model]);

  const handleMouseDownInWrapper = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const { ui } = stores;
    const { model } = props;
    const readOnlyValue = isReadOnly();
    const inLockedContainer = containerContext.isLocked;

    // Don't select a locked prompt
    if (props.model.fixedPosition && inLockedContainer) {
      return;
    }

    const append = hasSelectionModifier(e);
    const isWrapperClick = e.target === textTileDivRef.current;
    userSelectTile(ui, model, { readOnly: readOnlyValue, append, container: containerContext.model });

    if (isWrapperClick || append) {
      if (readOnlyValue) {
        // In read-only mode, just prevent the default to avoid Slate's auto-select
        // but don't stop propagation to allow text selection to work
        e.preventDefault();
      } else if (isWrapperClick) {
        // In editable mode, focus the editor for wrapper clicks
        editorRef.current && ReactEditor.focus(editorRef.current);
        e.preventDefault();
      }
    }
  }, [stores, props, isReadOnly, containerContext.isLocked, containerContext.model]);

  const handleBlur = useCallback(() => {
    const readOnlyValue = isReadOnly();

    if (!readOnlyValue) {
      // If the text has changed since the editor was focused, log the new text.
      const text = getContent().text;
      if (text !== textOnFocusRef.current) {
        const plainText = getContent().asPlainText();
        const wordCount = countWords(plainText);
        const change = {args:[{ text }]};
        logTileChangeEvent(LogEventName.TEXT_TOOL_CHANGE, {
          operation: 'update',
          change,
          plainText,
          wordCount,
          tileId: props.model.id });
      }

      setState(prev => ({ ...prev, revision: prev.revision + 1 })); // Force a rerender
    }
  }, [isReadOnly, getContent, props.model.id]);

  const handleFocus = useCallback(() => {
    const readOnlyValue = isReadOnly();

    if (!readOnlyValue) {
      textOnFocusRef.current = getContent().textStr;
    }
    setState(prev => ({ ...prev, revision: prev.revision + 1 })); // Force a rerender
  }, [isReadOnly, getContent]);

  // Initialize editor and plugins
  useEffect(() => {
    const textContent = getContent();

    const updateTextWithCustomizedExemplar = async () => {
      if (!props.documentId || !props.model.id) {
        console.log("No documentId or tileId found");
        return;
      }
      console.log("Updating text with customized exemplar");
      let response;
      response = await getCustomizedExemplar({
        context,
        dynamicContentPrompt: textContent.dynamicContentPrompt,
        unit: stores.unit.code,
        documentId: props.documentId,
        tileId: props.model.id
      });
      console.log("Response from getCustomizedExemplar", response);
      textContent.setText(response.data.text);
    }

    if (textContent.dynamicContent) {
      textContent.setText("Loading customized content...");
      updateTextWithCustomizedExemplar();
    }

    pluginsRef.current = createTextPluginInstances(textContent);
    const options: any = {}; // FIXME: type. ICreateEditorOptions is not currently exported from slate
    // Gather all the plugin init functions and pass that to slate.
    const onInitEditor = (e: Editor) => {
      Object.values(pluginsRef.current).forEach(plugin => {
        if (plugin?.onInitEditor) {
          e = plugin.onInitEditor(e);
        }
      });
      return e;
    };
    options.onInitEditor = onInitEditor;
    options.history = false;
    const editor = createEditor(options);
    editorRef.current = editor;
    getContent().setEditor(editor);
    setInitialValue(getContent().asSlate());

    // Synchronize slate with model changes. e.g. changes to any text in another tile is refelected here.
    const disposer1 = reaction(
      () => getContent().text,
      () => {
        // Update slate when content model changes
        if (!isHandlingUserChangeRef.current) {
          const contentModel = getContent();
          if (editorRef.current) {
            editorRef.current.children = contentModel.asSlate();
            normalizeSelection(editorRef.current);
            setState(prev => ({ ...prev, revision: prev.revision + 1 })); // Force a rerender
          }
        }
      }
    );

    // blur editor when tile is deselected
    const disposer2 = reaction(
      () => {
        const { model: { id } } = props;
        const { ui: { selectedTileIds } } = stores;
        return selectedTileIds.includes(id);
      },
      isTileSelected => {
        const isFocused = editorRef.current && ReactEditor.isFocused(editorRef.current);
        if (isFocused && !isTileSelected) {
          editorRef.current && ReactEditor.blur(editorRef.current);
        }
      }
    );

    disposersRef.current = [disposer1, disposer2];

    // Register tile API
    props.onRegisterTileApi({
      exportContentAsTileJson: () => {
        return getContent().exportJson();
      },
      handleDocumentScroll: (x: number, y: number) => {
        toolbarTileApiRef.current?.handleDocumentScroll?.(x, y);
      },
      handleTileResize: (entry: TileResizeEntry) => {
        const { x, y, width, height, top, left, bottom, right } = entry.contentRect;
        tileContentRectRef.current = { x, y, width, height, top, left, bottom, right, toJSON: () => "" };
        toolbarTileApiRef.current?.handleTileResize?.(entry);
      },
      getObjectBoundingBox: (objectId: string, objectType?: string) => {
        if (objectType === kHighlightFormat) {
          const box = getContent().highlightBoxesCache.get(objectId);
          if (box) return box;
        }
      },
      getObjectDefaultOffsets: (objectId: string, objectType?: string) => {
        // offset the annotation arrows to the right top corner of the bounding box until connected to a target,
        // and then offset should be the center of the edge closes to the target
        const offsets = OffsetModel.create({});
        if (objectType === kHighlightFormat) {
          const box = getContent().highlightBoxesCache.get(objectId);
          if (box) {
            const { width, height } = box;
            offsets.setDx(width / 2);
            offsets.setDy(- height / 2);
          }
        }
        return offsets;
      }
    });

    // Cleanup function
    return () => {
      disposersRef.current.forEach(disposer => disposer());
      for (const plugin of Object.values(pluginsRef.current)) {
        plugin?.dispose?.();
      }
    };
  }, [getContent, props.onRegisterTileApi, stores, props.model.id]);

  const { appConfig: { placeholderText } } = stores;
  const readOnly = isReadOnly();

  const editableClass = readOnly ? "read-only" : "editable";
  const containerClasses = classNames("tile-content", "text-tool-wrapper", {
    editable: !readOnly,
    hovered: props.hovered,
    selected: stores.ui.isSelectedTile(props.model),
  });
  // Ideally this would just be 'text-tool-editor', but 'text-tool' has been
  // used here for a while now and cypress tests depend on it. Should transition
  // to using 'text-tool-editor' for these purposes moving forward.
  const slateClasses = `text-tool text-tool-editor ${editableClass}`;

  if (!initialValue) return null;

  return (
    // Ideally, this would just be 'text-tool' for consistency with other tools,
    // but 'text-tool` is used for the internal editor (cf. 'classes' above),
    // which is used for cypress tests and other purposes.
    // TODO: replace this provider with one at the tile level so we get it for free.
    // and then replace the drawing one with that as well
    <TextContentModelContext.Provider value={getContent()} >
      <TextPluginsContext.Provider value={plugins} >
        <HighlightRevisionContext.Provider value={state.revision}>
          <HighlightRegistryContext.Provider value={handleUpdateHighlightBoxCache}>
            <div
              className={containerClasses}
              data-testid="text-tool-wrapper"
              ref={textTileDivRef}
              onMouseDown={handleMouseDownInWrapper}
            >
              <Slate
                editor={editorRef.current as ReactEditor}
                initialValue={initialValue}
                onChange={handleChange}
              >
                <SlateEditor
                  placeholder={placeholderText}
                  hotkeyMap={defaultHotkeyMap}
                  readOnly={readOnly}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className={`ccrte-editor slate-editor ${slateClasses || ""}`}
                />
                <TileToolbar tileType="text" tileElement={props.tileElt} readOnly={!!readOnly} />
              </Slate>
            </div>
          </HighlightRegistryContext.Provider>
        </HighlightRevisionContext.Provider>
      </TextPluginsContext.Provider>
    </TextContentModelContext.Provider>
  );
});

export default TextToolComponent;
