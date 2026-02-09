import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { DrawingToolbarContext } from "../components/drawing-toolbar-context";
import { VoiceTyping } from "../../../utilities/voice-typing";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../../lib/logger-types";
import { isTextObject, TextObjectType } from "../objects/text";

import VoiceTypingIcon from "../../../assets/icons/text/voice-typing-text-icon.svg";

import "./voice-typing-button.scss";

/**
 * Get the focused textarea element if one exists, or null.
 */
function getFocusedTextarea(): HTMLTextAreaElement | null {
  const el = document.activeElement;
  return el instanceof HTMLTextAreaElement ? el : null;
}

export const VoiceTypingDrawingButton = observer(
  function VoiceTypingDrawingButton({ name }: IToolbarButtonComponentProps) {
    const drawingModel = useContext(DrawingContentModelContext);
    const tileModel = useContext(TileModelContext);
    const toolbarContext = useContext(DrawingToolbarContext);
    const [active, setActive] = useState(false);
    const [announcement, setAnnouncement] = useState("");

    const voiceTypingRef = useRef<VoiceTyping | null>(null);
    const activeRef = useRef(active);
    activeRef.current = active;

    // Track the "committed" text (before any interim) and the insertion offset within it
    const committedTextRef = useRef("");
    const insertionOffsetRef = useRef(0);

    // Find the currently editing text object
    const editingTextObject: TextObjectType | undefined = drawingModel?.objects.find(
      (obj: any) => isTextObject(obj) && obj.isEditing
    ) as TextObjectType | undefined;

    const editingTextObjectRef = useRef(editingTextObject);
    editingTextObjectRef.current = editingTextObject;

    const announce = useCallback((message: string) => {
      setAnnouncement(message);
      const timer = setTimeout(() => setAnnouncement(""), 2000);
      return () => clearTimeout(timer);
    }, []);

    const deactivate = useCallback((reason: "user" | "timeout" | "error" = "user") => {
      const vt = voiceTypingRef.current;
      if (vt?.isActive) {
        vt.disable();
      }
      setActive(false);
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
    }, [tileModel?.id, announce, toolbarContext]);

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
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
            // Clear the interim overlay
            toolbarContext?.setInterimText("");

            const obj = editingTextObjectRef.current;
            if (!obj) return;

            // Splice final text at the insertion offset within the committed base
            const base = committedTextRef.current;
            const offset = insertionOffsetRef.current;
            const before = base.slice(0, offset);
            const after = base.slice(offset);

            const needSpaceBefore = before.length > 0
              && !before.endsWith(" ") && !before.endsWith("\n");
            const prefix = needSpaceBefore ? " " : "";

            const newText = before + prefix + text + after;
            obj.setText(newText);

            // Advance committed text and insertion offset
            const newCursorPos = offset + prefix.length + text.length;
            committedTextRef.current = newText;
            insertionOffsetRef.current = newCursorPos;

            // Position cursor after the inserted text
            requestAnimationFrame(() => {
              const ta = getFocusedTextarea();
              if (ta) {
                ta.selectionStart = newCursorPos;
                ta.selectionEnd = newCursorPos;
              }
            });

            if (tileId) {
              // TODO: Confirm with stakeholders that logging transcribed text content is acceptable before merging
              logTileChangeEvent(LogEventName.DRAWING_TOOL_CHANGE, {
                operation: "voice-typing-insert",
                change: { args: [{ text }] },
                tileId,
              });
            }
          } else {
            // Show interim text in the floating overlay (no model changes)
            toolbarContext?.setInterimText(text);
          }
        },

        onStateChange: (isActive: boolean) => {
          if (!isActive) {
            setActive(false);
            toolbarContext?.setInterimText("");
            if (tileId) {
              logTileChangeEvent(LogEventName.DRAWING_TOOL_CHANGE, {
                operation: "voice-typing-stop",
                change: { reason: "timeout" },
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

      if (tileId) {
        logTileChangeEvent(LogEventName.DRAWING_TOOL_CHANGE, {
          operation: "voice-typing-start",
          change: {},
          tileId,
        });
      }

      announce("Voice typing on");
    }, [editingTextObject, tileModel?.id, announce, toolbarContext]);

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
