import React, { useContext } from "react";
import { v4 as uuid } from "uuid";
import { Path, Text } from "slate";
import { ReactEditor, Editor, Range, Transforms, useSlate } from "@concord-consortium/slate-editor";
import { HighlightsPlugin, kHighlightTextPluginName, kHighlightFormat, HighlightElement }
  from "../../../../plugins/text/highlights-plugin";
import { useStores } from "../../../../hooks/use-stores";
import { TileToolbarButton } from "../../../toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../toolbar/toolbar-button-manager";
import { TileModelContext } from "../../tile-api";
import { TextPluginsContext } from "../text-plugins-context";

import HighlightToolIcon from "../../../../assets/icons/text/highlight-text-icon.svg";

export const HighlightButton = ({name}: IToolbarButtonComponentProps) => {
  const editor = useSlate();
  const plugins = useContext(TextPluginsContext);
  const model = useContext(TileModelContext);
  const stores = useStores();
  const highlightsPlugin = plugins[kHighlightTextPluginName] as HighlightsPlugin | undefined;
  const { selection } = editor;
  const isHighlightedText = editor.isElementActive(kHighlightFormat);
  const isCollapsed = selection ? Range.isCollapsed(selection) : true;
  const isSelected = !!selection && !isCollapsed;
  const disabled = !isHighlightedText && isCollapsed && !isSelected;
  const getSelectedChips = () => {
    if (!selection) return undefined;
    // Find the highlight chip nodes at selection
    return Array.from(Editor.nodes(editor, {
      match: n => (n as any).type === kHighlightFormat,
      at: selection
    })) as [HighlightElement, Path][];
  };

  const highlightText = (reference: string, text: string, marks?: Record<string, any>) =>{
    if (!editor.selection || Range.isCollapsed(editor.selection)) return;
    const selectionLength = Editor.string(editor, editor.selection).length;
    if (selectionLength === 0) return;

    const highlightNode: HighlightElement = {
      type: kHighlightFormat,
      highlightId: reference,
      children: [{ text, ...marks }]
    };
    // Replace selected text with the highlight chip
    Transforms.delete(editor, { at: editor.selection });
    Transforms.insertNodes(editor, highlightNode);
    Transforms.collapse(editor, { edge: "end" });
  };

  const unHighlightChip = (chipEntry: [HighlightElement, Path]) => {
    if (!editor.selection) return;
    if (chipEntry) {
      const [chipNode, chipPath] = chipEntry as [HighlightElement, Path];
      const nodeBeforeHighlight = Editor.previous(editor, { at: chipPath });
      if (nodeBeforeHighlight && Text.isText(nodeBeforeHighlight[0])) {
        const nodeBeforeHighlightText = nodeBeforeHighlight[0].text;
        const startOffset = nodeBeforeHighlightText.length;
        const previousPath = Path.previous(chipPath);
        const insertPoint = Editor.end(editor, previousPath);
        const chipNodeChild = chipNode.children[0] as { text: string, marks?: Record<string, any> };
        const { text, ...marks } = chipNodeChild;
        Transforms.removeNodes(editor, { at: chipPath });
        Transforms.insertNodes(editor, { text, ...marks }, { at: insertPoint });
        // assume that when text is unhighlighted, the text is now part of the previous path
        // get the text node at the previous path
        const [prevNode, prevNodePath] = Editor.node(editor, previousPath);
        if (prevNode && prevNodePath) {
          if (Text.isText(prevNode)) {
            if (startOffset !== -1) {
              const endOffset = startOffset + text.length;
              const range = { anchor: { path: prevNodePath, offset: startOffset },
                              focus: { path: prevNodePath, offset: endOffset } };
              setTimeout(() => {
                ReactEditor.focus(editor);
                Transforms.select(editor, range);
              }, 0);
            }
          }
        }
      }
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    if (isHighlightedText) {
      const selectedChips = getSelectedChips();
      if (!selectedChips || selectedChips.length === 0) return;
      const chipReferences = selectedChips.map(([chipNode]) => chipNode.highlightId);

      const removeAnnotationsForHighlight = (highlightId: string) => {
        if (!stores?.documents || !model?.id) return;
        const document = stores.documents.findDocumentOfTile(model.id);
        if (!document?.content) return;
        const annotationsToRemove: string[] = [];
        document.content.annotations.forEach((annotation) => {
          // Check if the annotation's source or target object references this highlight
          if (annotation.sourceObject?.objectId === highlightId &&
                annotation.sourceObject?.objectType === kHighlightFormat) {
            annotationsToRemove.push(annotation.id);
          }
          if (annotation.targetObject?.objectId === highlightId &&
                annotation.targetObject?.objectType === kHighlightFormat) {
            annotationsToRemove.push(annotation.id);
          }
        });
        annotationsToRemove.forEach(annotationId => {
          if (document.content) {
            document.content.deleteAnnotation(annotationId);
          }
        });
      };

      chipReferences.forEach(ref => {
        const [chipEntry] = Array.from(Editor.nodes(editor, {
          match: n => (n as any).type === kHighlightFormat && (n as any).highlightId === ref,
          at: selection ?? undefined
        })) as [HighlightElement, Path][];
        if (chipEntry) {
          const chipReference = chipEntry[0].highlightId;
          highlightsPlugin?.removeHighlight(ref);
          unHighlightChip(chipEntry);
          removeAnnotationsForHighlight(chipReference);
        }
      });
      Transforms.deselect(editor);
      // Clear DOM selection because the Slate editor is not updating the DOM selection
      if (typeof window !== "undefined") {
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
      }
      return;
    }

    if (!editor.selection || Range.isCollapsed(editor.selection)) return;

    const selectedText = Editor.string(editor, editor.selection);
    const selectedTextMarks = Editor.marks(editor);
    const reference = uuid();
    highlightsPlugin?.addHighlight(reference, selectedText);
    highlightText(reference, selectedText, selectedTextMarks || undefined);
  };

  return (
    <TileToolbarButton
      name={name}
      title="Highlight"
      disabled={disabled}
      selected={isHighlightedText}
      onClick={handleClick}
      dataTestId="text-highlight-button"
    >
      <HighlightToolIcon/>
    </TileToolbarButton>
  );
};
