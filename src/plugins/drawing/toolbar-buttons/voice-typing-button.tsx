import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { DrawingToolbarContext } from "../components/drawing-toolbar-context";
import { VoiceTyping } from "../../../utilities/voice-typing";
import { spliceWithSpacing } from "../../../utilities/voice-typing-utils";
import { useAnnounce } from "../../../utilities/use-announce";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../../lib/logger-types";
import { isTextObject, TextObjectType } from "../objects/text";

import VoiceTypingIcon from "../../../assets/icons/text/voice-typing-text-icon.svg";

import "../../../utilities/voice-typing-button.scss";

/**
 * Get the focused text input element (textarea or input) if one exists, or null.
 */
function getFocusedTextInput(): HTMLTextAreaElement | HTMLInputElement | null {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el;
  return null;
}

type VoiceTypingTarget = "title" | "text-object" | null;

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
    const insertionEndOffsetRef = useRef(0);
    const interimTextRef = useRef("");

    // Find the currently editing text object
    const editingTextObject: TextObjectType | undefined = drawingModel?.objects.find(
      (obj: any) => isTextObject(obj) && obj.isEditing
    ) as TextObjectType | undefined;

    const editingTextObjectRef = useRef(editingTextObject);
    editingTextObjectRef.current = editingTextObject;

    // Determine the current voice typing target
    const titleEditing = toolbarContext?.titleEditing ?? false;
    const target: VoiceTypingTarget =
      editingTextObject ? "text-object" : titleEditing ? "title" : null;
    const targetRef = useRef(target);
    // targetRef is updated in the useEffect below AFTER deactivation, so that
    // commitInterimText still sees the PREVIOUS target during a switch.

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
        const el = getFocusedTextInput();
        if (el) {
          el.selectionStart = newCursorPos;
          el.selectionEnd = newCursorPos;
        }
      });
    }, []);

    // Insert text into the title input via the registered inserter.
    // Replaces the selected range (insertionOffsetRef..insertionEndOffsetRef) if any.
    const insertIntoTitle = useCallback((text: string) => {
      const inserter = toolbarContext?.titleTextInserter;
      if (!inserter) return;
      const { newText, newCursorPos } = spliceWithSpacing(
        committedTextRef.current, insertionOffsetRef.current, text, insertionEndOffsetRef.current
      );
      inserter(newText, newCursorPos);
      committedTextRef.current = newText;
      insertionOffsetRef.current = newCursorPos;
      insertionEndOffsetRef.current = newCursorPos; // collapse selection after first insert
      // Update cursor position in the focused input
      requestAnimationFrame(() => {
        const input = document.activeElement;
        if (input instanceof HTMLInputElement) {
          input.selectionStart = newCursorPos;
          input.selectionEnd = newCursorPos;
        }
      });
    }, [toolbarContext?.titleTextInserter]);

    // Commit any pending interim text to the correct target.
    const commitInterimText = useCallback(() => {
      const text = interimTextRef.current;
      if (!text) return;
      interimTextRef.current = "";
      toolbarContext?.setInterimText("");
      if (targetRef.current === "title") {
        insertIntoTitle(text);
      } else {
        insertIntoTextObject(text);
      }
    }, [insertIntoTextObject, insertIntoTitle, toolbarContext]);

    // Keep a ref so onBeforeClose always calls the latest commitInterimText
    const commitInterimTextFnRef = useRef(commitInterimText);
    commitInterimTextFnRef.current = commitInterimText;

    // Shared stop sequence: commit interim text, clear context, reset state, log, announce.
    // Used by both deactivate() and onStateChange(!isActive).
    const stop = useCallback((reason: string) => {
      commitInterimTextFnRef.current();
      if (toolbarContext) {
        toolbarContext.commitInterimTextRef.current = null;
      }
      setActive(false);
      toolbarContext?.setVoiceTypingActive(false);
      toolbarContext?.setInterimText("");
      const tileId = tileModel?.id || "";
      if (tileId) {
        logTileChangeEvent(LogEventName.DRAWING_TOOL_CHANGE, {
          operation: "voice-typing-stop",
          change: { reason, target: targetRef.current },
          tileId,
        });
      }
      announce("Voice typing off");
    }, [tileModel?.id, announce, toolbarContext]);

    const deactivate = useCallback((reason: "user" | "timeout" | "error" = "user") => {
      const vt = voiceTypingRef.current;
      if (vt?.isActive) {
        vt.disable(reason);
      }
      stop(reason);
    }, [stop]);

    const stopRef = useRef(stop);
    stopRef.current = stop;
    const deactivateRef = useRef(deactivate);
    deactivateRef.current = deactivate;

    // Deactivate when target changes while active (e.g., switching from title to text object)
    const prevTargetRef = useRef(target);
    useEffect(() => {
      if (active && prevTargetRef.current !== null && prevTargetRef.current !== target) {
        // targetRef.current still points to the PREVIOUS target here,
        // so commitInterimText (called inside deactivate) commits to the right place.
        deactivateRef.current("user");
      }
      // Update refs AFTER deactivation
      targetRef.current = target;
      prevTargetRef.current = target;
    }, [active, target]);

    // Update insertion offset when user repositions cursor (click or arrow keys)
    useEffect(() => {
      if (!active) return;

      const updateOffsetFromInput = () => {
        requestAnimationFrame(() => {
          const el = getFocusedTextInput();
          if (!el) return;
          insertionOffsetRef.current = el.selectionStart ?? insertionOffsetRef.current;
          insertionEndOffsetRef.current = el.selectionEnd ?? insertionOffsetRef.current;
        });
      };

      const handlePointerUp = (e: PointerEvent) => {
        const pointerTarget = e.target as HTMLElement;
        if (pointerTarget instanceof HTMLTextAreaElement || pointerTarget instanceof HTMLInputElement) {
          updateOffsetFromInput();
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
          updateOffsetFromInput();
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
      if (!editingTextObject && !titleEditing) return;
      if (!voiceTypingRef.current) {
        voiceTypingRef.current = new VoiceTyping();
      }
      const vt = voiceTypingRef.current;
      const tileId = tileModel?.id || "";
      const currentTarget = targetRef.current;

      // Capture committed text and cursor/selection position at activation
      if (currentTarget === "text-object" && editingTextObject) {
        committedTextRef.current = editingTextObject.text;
        const textarea = getFocusedTextInput();
        insertionOffsetRef.current = textarea?.selectionStart ?? editingTextObject.text.length;
        insertionEndOffsetRef.current = insertionOffsetRef.current;
      } else if (currentTarget === "title") {
        const input = getFocusedTextInput();
        committedTextRef.current = input?.value ?? "";
        insertionOffsetRef.current = input?.selectionStart ?? committedTextRef.current.length;
        insertionEndOffsetRef.current = input?.selectionEnd ?? insertionOffsetRef.current;
      }

      // Register commitInterimText in context so onBeforeClose can call it
      if (toolbarContext) {
        toolbarContext.commitInterimTextRef.current = () => commitInterimTextFnRef.current();
      }

      vt.enable({
        onTranscript: (text: string, isFinal: boolean) => {
          if (isFinal) {
            interimTextRef.current = "";
            toolbarContext?.setInterimText("");
            const insertText = targetRef.current === "title" ? insertIntoTitle : insertIntoTextObject;
            insertText(text);

            if (tileId) {
              logTileChangeEvent(LogEventName.DRAWING_TOOL_CHANGE, {
                operation: "voice-typing-insert",
                change: { args: [{ text }], target: targetRef.current },
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
            stopRef.current(reason || "user");
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
          change: { target: currentTarget },
          tileId,
        });
      }

      announce("Voice typing on");
    }, [editingTextObject, titleEditing, insertIntoTextObject,
        insertIntoTitle, tileModel?.id, announce, toolbarContext]);

    // Don't render if not supported
    if (!VoiceTyping.supported) return null;

    // Enable when a text object or the title bar is being edited
    const disabled = !editingTextObject && !titleEditing;

    // Prevent mousedown from stealing focus from the textarea/input (which would end editing)
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
