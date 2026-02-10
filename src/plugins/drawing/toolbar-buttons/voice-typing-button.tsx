import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { DrawingToolbarContext } from "../components/drawing-toolbar-context";
import { VoiceTyping } from "../../../utilities/voice-typing";
import { useAnnounce } from "../../../utilities/use-announce";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../../lib/logger-types";
import { isTextObject, TextObjectType } from "../objects/text";

import VoiceTypingIcon from "../../../assets/icons/text/voice-typing-text-icon.svg";

import "../../../utilities/voice-typing-button.scss";

/**
 * Get the focused textarea element if one exists, or null.
 */
function getFocusedTextarea(): HTMLTextAreaElement | null {
  const el = document.activeElement;
  return el instanceof HTMLTextAreaElement ? el : null;
}

/**
 * Splice text into a base string at the given offset, adding spaces as needed.
 */
function spliceWithSpacing(base: string, offset: number, text: string) {
  const before = base.slice(0, offset);
  const after = base.slice(offset);

  const needSpaceBefore = before.length > 0
    && !before.endsWith(" ") && !before.endsWith("\n");
  const prefix = needSpaceBefore ? " " : "";

  const needSpaceAfter = after.length > 0
    && !after.startsWith(" ") && !after.startsWith("\n");
  const suffix = needSpaceAfter ? " " : "";

  return {
    newText: before + prefix + text + suffix + after,
    newCursorPos: offset + prefix.length + text.length + suffix.length,
  };
}

export const VoiceTypingDrawingButton = observer(
  function VoiceTypingDrawingButton({ name }: IToolbarButtonComponentProps) {
    const drawingModel = useContext(DrawingContentModelContext);
    const tileModel = useContext(TileModelContext);
    const toolbarContext = useContext(DrawingToolbarContext);
    const [active, setActive] = useState(false);
    const { announcement, announce } = useAnnounce();

    const voiceTypingRef = useRef<VoiceTyping | null>(null);
    const activeRef = useRef(active);
    activeRef.current = active;

    // Track the "committed" text (before any interim) and the insertion offset within it
    const committedTextRef = useRef("");
    const insertionOffsetRef = useRef(0);
    const interimTextRef = useRef("");

    // Find the currently editing text object
    const editingTextObject: TextObjectType | undefined = drawingModel?.objects.find(
      (obj: any) => isTextObject(obj) && obj.isEditing
    ) as TextObjectType | undefined;

    const editingTextObjectRef = useRef(editingTextObject);
    editingTextObjectRef.current = editingTextObject;

    // Insert text into the editing text object at the current insertion offset.
    const insertIntoTextObject = useCallback((text: string) => {
      const obj = editingTextObjectRef.current;
      if (!obj) return;

      const { newText, newCursorPos } = spliceWithSpacing(
        committedTextRef.current, insertionOffsetRef.current, text
      );
      obj.setText(newText);
      committedTextRef.current = newText;
      insertionOffsetRef.current = newCursorPos;

      requestAnimationFrame(() => {
        const ta = getFocusedTextarea();
        if (ta) {
          ta.selectionStart = newCursorPos;
          ta.selectionEnd = newCursorPos;
        }
      });
    }, []);

    // Commit any pending interim text into the text object before tearing down.
    const commitInterimText = useCallback(() => {
      const text = interimTextRef.current;
      if (!text) return;
      interimTextRef.current = "";
      insertIntoTextObject(text);
    }, [insertIntoTextObject]);

    const deactivate = useCallback((reason: "user" | "timeout" | "error" = "user") => {
      const vt = voiceTypingRef.current;
      if (vt?.isActive) {
        vt.disable(reason);
      }

      // Commit any pending interim text before tearing down
      commitInterimText();

      setActive(false);
      toolbarContext?.setVoiceTypingActive(false);
      toolbarContext?.setInterimText("");

      const tileId = tileModel?.id || "";
      if (tileId) {
        logTileChangeEvent(LogEventName.DRAWING_TOOL_CHANGE, {
          operation: "voice-typing-stop",
          change: { reason },
          tileId,
        });
      }

      announce("Voice typing off");
    }, [commitInterimText, tileModel?.id, announce, toolbarContext]);

    const deactivateRef = useRef(deactivate);
    deactivateRef.current = deactivate;

    // Deactivate when text object stops editing
    useEffect(() => {
      if (active && !editingTextObject) {
        deactivateRef.current("user");
      }
    }, [active, editingTextObject]);

    // Update insertion offset when user repositions cursor (click or arrow keys)
    useEffect(() => {
      if (!active) return;

      const updateOffsetFromTextarea = () => {
        requestAnimationFrame(() => {
          const textarea = getFocusedTextarea();
          if (!textarea) return;
          insertionOffsetRef.current = textarea.selectionStart ?? insertionOffsetRef.current;
        });
      };

      const handlePointerUp = (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        if (target instanceof HTMLTextAreaElement) {
          updateOffsetFromTextarea();
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
          updateOffsetFromTextarea();
        }
      };

      document.addEventListener("pointerup", handlePointerUp, true);
      document.addEventListener("keyup", handleKeyUp, true);
      return () => {
        document.removeEventListener("pointerup", handlePointerUp, true);
        document.removeEventListener("keyup", handleKeyUp, true);
      };
    }, [active]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (activeRef.current) {
          deactivateRef.current("user");
        }
      };
    }, []);

    const activate = useCallback(() => {
      if (!editingTextObject) return;
      if (!voiceTypingRef.current) {
        voiceTypingRef.current = new VoiceTyping();
      }
      const vt = voiceTypingRef.current;
      const tileId = tileModel?.id || "";

      // Capture committed text and cursor position at activation
      committedTextRef.current = editingTextObject.text;
      const textarea = getFocusedTextarea();
      insertionOffsetRef.current = textarea?.selectionStart ?? editingTextObject.text.length;

      vt.enable({
        onTranscript: (text: string, isFinal: boolean) => {
          if (isFinal) {
            interimTextRef.current = "";
            toolbarContext?.setInterimText("");
            insertIntoTextObject(text);

            if (tileId) {
              logTileChangeEvent(LogEventName.DRAWING_TOOL_CHANGE, {
                operation: "voice-typing-insert",
                change: { args: [{ text }] },
                tileId,
              });
            }
          } else {
            // Show interim text in the floating overlay (no model changes)
            interimTextRef.current = text;
            toolbarContext?.setInterimText(text);
          }
        },

        onStateChange: (isActive, reason) => {
          if (!isActive) {
            // Commit any pending interim text before tearing down
            commitInterimText();
            setActive(false);
            toolbarContext?.setVoiceTypingActive(false);
            toolbarContext?.setInterimText("");
            if (tileId) {
              logTileChangeEvent(LogEventName.DRAWING_TOOL_CHANGE, {
                operation: "voice-typing-stop",
                change: { reason: reason || "user" },
                tileId,
              });
            }
            announce("Voice typing off");
          }
        },

        onError: (error: string) => {
          console.warn("Voice typing error (drawing):", error);
        },
      });

      setActive(true);
      toolbarContext?.setVoiceTypingActive(true);

      if (tileId) {
        logTileChangeEvent(LogEventName.DRAWING_TOOL_CHANGE, {
          operation: "voice-typing-start",
          change: {},
          tileId,
        });
      }

      announce("Voice typing on");
    }, [editingTextObject, commitInterimText, insertIntoTextObject, tileModel?.id, announce, toolbarContext]);

    // Don't render if not supported
    if (!VoiceTyping.supported) return null;

    // Only enable when a text object is being edited
    const disabled = !editingTextObject;

    // Prevent mousedown from stealing focus from the textarea (which would end editing)
    const handleMouseDown = (e: React.MouseEvent) => {
      if (!disabled) {
        e.preventDefault();
      }
    };

    const handleClick = () => {
      if (active) {
        deactivate("user");
      } else {
        activate();
      }
    };

    const title = active ? "Voice Typing: On" : "Voice Typing: Off";

    return (
      <>
        <span onMouseDown={handleMouseDown}>
          <TileToolbarButton
            name={name}
            title={title}
            selected={active}
            disabled={disabled}
            onClick={handleClick}
            dataTestId="voice-typing-drawing-button"
          >
            <VoiceTypingIcon />
          </TileToolbarButton>
        </span>
        <div
          aria-live="polite"
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
        >
          {announcement}
        </div>
      </>
    );
  }
);
