import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Editor, Range, Transforms, useSlate } from "@concord-consortium/slate-editor";
import { BaseEditor } from "slate";
import { TileToolbarButton } from "../../../toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../toolbar/toolbar-button-manager";
import { TileModelContext } from "../../tile-api";
import { TextTileToolbarContext } from "../text-toolbar-context";
import { VoiceTyping } from "../../../../utilities/voice-typing";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../../../lib/logger-types";

import VoiceTypingIcon from "../../../../assets/icons/text/voice-typing-text-icon.svg";

import "./voice-typing-button.scss";

// Keys allowed while voice typing is active
const ALLOWED_KEYS = new Set([
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Home", "End",
  "Tab", "Escape",
]);

function isAllowedKeyCombo(e: KeyboardEvent): boolean {
  if (ALLOWED_KEYS.has(e.key)) return true;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === "a") return true; // Select all
  if (mod && e.key === "c") return true; // Copy
  if (mod && e.key === "z" && !e.shiftKey) return true; // Undo
  if (mod && e.key === "z" && e.shiftKey) return true; // Redo
  if (mod && e.key === "Z") return true; // Redo (Mac)
  return false;
}

type SlatePointRef = ReturnType<typeof Editor.pointRef>;

export function VoiceTypingButton({ name }: IToolbarButtonComponentProps) {
  const editor = useSlate();
  const model = useContext(TileModelContext);
  const toolbarContext = useContext(TextTileToolbarContext);
  const [active, setActive] = useState(false);

  // Refs for voice typing state
  const voiceTypingRef = useRef<VoiceTyping | null>(null);
  const isVoiceTypingInsert = useRef(false);
  const anchorPointRef = useRef<SlatePointRef | null>(null);

  // Store original editor methods for restoration
  const originalMethods = useRef<{
    insertText: BaseEditor["insertText"];
    deleteBackward: BaseEditor["deleteBackward"];
    deleteForward: BaseEditor["deleteForward"];
    insertBreak: BaseEditor["insertBreak"];
    insertFragment: BaseEditor["insertFragment"];
    insertData?: (data: DataTransfer) => void;
  } | null>(null);

  // Aria-live announcement
  const [announcement, setAnnouncement] = useState("");

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    const timer = setTimeout(() => setAnnouncement(""), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Clean up Slate anchor ref
  const cleanupSlateRefs = useCallback(() => {
    if (anchorPointRef.current) {
      try { anchorPointRef.current.unref(); } catch { /* already unrefed */ }
      anchorPointRef.current = null;
    }
  }, []);

  // Restore original editor methods
  const restoreEditorMethods = useCallback(() => {
    if (originalMethods.current) {
      editor.insertText = originalMethods.current.insertText;
      editor.deleteBackward = originalMethods.current.deleteBackward;
      editor.deleteForward = originalMethods.current.deleteForward;
      editor.insertBreak = originalMethods.current.insertBreak;
      editor.insertFragment = originalMethods.current.insertFragment;
      if (originalMethods.current.insertData) {
        (editor as any).insertData = originalMethods.current.insertData;
      }
      originalMethods.current = null;
    }
  }, [editor]);

  // Install editor method overrides to block keyboard input
  const installEditorOverrides = useCallback(() => {
    originalMethods.current = {
      insertText: editor.insertText,
      deleteBackward: editor.deleteBackward,
      deleteForward: editor.deleteForward,
      insertBreak: editor.insertBreak,
      insertFragment: editor.insertFragment,
      insertData: (editor as any).insertData,
    };

    editor.insertText = (text: string) => {
      if (isVoiceTypingInsert.current) {
        originalMethods.current!.insertText(text);
      }
      // else: blocked
    };
    editor.deleteBackward = (unit: "character" | "word" | "line" | "block") => {
      if (isVoiceTypingInsert.current) {
        originalMethods.current!.deleteBackward(unit);
      }
    };
    editor.deleteForward = (unit: "character" | "word" | "line" | "block") => {
      if (isVoiceTypingInsert.current) {
        originalMethods.current!.deleteForward(unit);
      }
    };
    editor.insertBreak = () => {
      if (isVoiceTypingInsert.current) {
        originalMethods.current!.insertBreak();
      }
    };
    editor.insertFragment = (fragment: any) => {
      if (isVoiceTypingInsert.current) {
        originalMethods.current!.insertFragment(fragment);
      }
    };
    if ((editor as any).insertData) {
      (editor as any).insertData = (data: DataTransfer) => {
        if (isVoiceTypingInsert.current) {
          originalMethods.current!.insertData?.(data);
        }
      };
    }
  }, [editor]);

  // Perform a voice typing insert (sets flag around the operation)
  const doVoiceInsert = useCallback((fn: () => void) => {
    isVoiceTypingInsert.current = true;
    try {
      fn();
    } finally {
      isVoiceTypingInsert.current = false;
    }
  }, []);

  // Deactivation function
  const deactivate = useCallback((reason: "user" | "timeout" | "error" = "user") => {
    const vt = voiceTypingRef.current;

    if (vt?.isActive) {
      vt.disable();
    }

    restoreEditorMethods();
    cleanupSlateRefs();

    setActive(false);
    toolbarContext?.setVoiceTypingActive(false);
    toolbarContext?.setInterimText("");

    if (model?.id) {
      logTileChangeEvent(LogEventName.TEXT_TOOL_CHANGE, {
        operation: "voice-typing-stop",
        change: { reason },
        tileId: model.id,
      });
    }

    announce("Voice typing off");
  }, [restoreEditorMethods, cleanupSlateRefs, toolbarContext, model?.id, announce]);

  // Keep deactivate ref current for use in event handlers
  const deactivateRef = useRef(deactivate);
  deactivateRef.current = deactivate;

  // Keep active ref current for use in event handlers
  const activeRef = useRef(active);
  activeRef.current = active;

  // Keydown handler
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        deactivateRef.current("user");
        return;
      }
      if (!isAllowedKeyCombo(e)) {
        e.preventDefault();
      }
    };

    // Use capture phase to intercept before Slate
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [active]);

  // Pointerdown handler for click-outside deactivation
  useEffect(() => {
    if (!active) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Check if click is on the voice-typing button itself — let onClick handle it
      if (target.closest(".toolbar-button.voice-typing")) return;

      // Check if click is on another toolbar button — deactivate but let the button action fire
      if (target.closest(".toolbar-button")) {
        deactivateRef.current("user");
        return;
      }

      // Check if click is inside the text tile editor area — allow it (arrow key navigation etc.)
      if (target.closest(".text-tool-editor")) return;

      // Click outside the editor and toolbar — deactivate
      deactivateRef.current("user");
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [active]);

  // Update anchor point when user repositions cursor (click or arrow keys)
  useEffect(() => {
    if (!active) return;

    const updateAnchorFromSelection = () => {
      requestAnimationFrame(() => {
        const selection = editor.selection;
        if (!selection) return;

        const newPoint = Range.isCollapsed(selection)
          ? selection.anchor
          : selection.focus;

        if (anchorPointRef.current) {
          try { anchorPointRef.current.unref(); } catch { /* ok */ }
        }
        anchorPointRef.current = Editor.pointRef(editor, newPoint);
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest(".text-tool-editor")) {
        updateAnchorFromSelection();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
        updateAnchorFromSelection();
      }
    };

    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("keyup", handleKeyUp, true);
    return () => {
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [active, editor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeRef.current) {
        deactivateRef.current("user");
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Activation function
  const activate = useCallback(() => {
    if (!voiceTypingRef.current) {
      voiceTypingRef.current = new VoiceTyping();
    }
    const vt = voiceTypingRef.current;

    // Ensure editor has a selection (PointRef needs an anchor)
    if (!editor.selection) {
      Transforms.select(editor, Editor.end(editor, []));
    }

    // Capture current cursor position
    const cursorPoint = editor.selection
      ? Range.isCollapsed(editor.selection)
        ? editor.selection.anchor
        : editor.selection.focus
      : Editor.end(editor, []);
    anchorPointRef.current = Editor.pointRef(editor, cursorPoint);

    // Install editor method overrides for keyboard blocking
    installEditorOverrides();

    const tileId = model?.id || "";

    vt.enable({
      onTranscript: (text: string, isFinal: boolean) => {
        if (isFinal) {
          // Clear the interim overlay
          toolbarContext?.setInterimText("");

          // Insert the final text into Slate
          doVoiceInsert(() => {
            const anchor = anchorPointRef.current?.current;
            if (!anchor) return;

            // Check spacing: add space before if needed
            const beforePoint = Editor.before(editor, anchor, { unit: "character" });
            const charBefore = beforePoint
              ? Editor.string(editor, { anchor: beforePoint, focus: anchor })
              : "";
            const needSpaceBefore = charBefore !== "" && charBefore !== " " && charBefore !== "\n";

            const textToInsert = (needSpaceBefore ? " " : "") + text;

            Transforms.insertText(editor, textToInsert, { at: anchor });

            // Check spacing: add space after if needed
            const newAnchor = anchorPointRef.current?.current;
            if (newAnchor) {
              const afterPoint = Editor.after(editor, newAnchor, { unit: "character" });
              const charAfter = afterPoint
                ? Editor.string(editor, { anchor: newAnchor, focus: afterPoint })
                : "";
              if (charAfter && !(/^[.,;:!? \n]/.test(charAfter))) {
                Transforms.insertText(editor, " ", { at: newAnchor });
              }
            }
          });

          // Log the final transcript
          if (tileId) {
            // TODO: Confirm with stakeholders that logging transcribed text content is acceptable before merging
            logTileChangeEvent(LogEventName.TEXT_TOOL_CHANGE, {
              operation: "voice-typing-insert",
              change: { args: [{ text }] },
              tileId,
            });
          }
        } else {
          // Show interim text in the floating overlay (no Slate operations)
          toolbarContext?.setInterimText(text);
        }
      },

      onStateChange: (isActive: boolean) => {
        if (!isActive) {
          // VoiceTyping module triggered deactivation (timeout, error, or single-instance eviction)
          restoreEditorMethods();
          cleanupSlateRefs();
          setActive(false);
          toolbarContext?.setVoiceTypingActive(false);
          toolbarContext?.setInterimText("");

          if (tileId) {
            logTileChangeEvent(LogEventName.TEXT_TOOL_CHANGE, {
              operation: "voice-typing-stop",
              change: { reason: "timeout" },
              tileId,
            });
          }

          announce("Voice typing off");
        }
      },

      onError: (error: string) => {
        console.warn("Voice typing error:", error);
      },
    });

    setActive(true);
    toolbarContext?.setVoiceTypingActive(true);

    if (tileId) {
      logTileChangeEvent(LogEventName.TEXT_TOOL_CHANGE, {
        operation: "voice-typing-start",
        change: {},
        tileId,
      });
    }

    announce("Voice typing on");
  }, [editor, model?.id, toolbarContext, installEditorOverrides, doVoiceInsert,
      restoreEditorMethods, cleanupSlateRefs, announce]);

  // Don't render if not supported
  if (!VoiceTyping.supported) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (active) {
      deactivate("user");
    } else {
      activate();
    }
  };

  const title = active ? "Voice Typing: On" : "Voice Typing: Off";

  return (
    <>
      <TileToolbarButton
        name={name}
        title={title}
        selected={active}
        onClick={handleClick}
        dataTestId="voice-typing-button"
      >
        <VoiceTypingIcon />
      </TileToolbarButton>
      <div
        aria-live="polite"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
      >
        {announcement}
      </div>
    </>
  );
}
