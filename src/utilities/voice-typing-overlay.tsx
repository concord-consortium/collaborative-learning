import React, { useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

import "./voice-typing-overlay.scss";

interface IVoiceTypingOverlayProps {
  text: string;
  tileElement: HTMLElement | null;
}

/**
 * A portal-based overlay that displays interim voice typing text.
 * Rendered into document.body so it is not clipped by the tile's overflow:hidden.
 * Positioned relative to the tile element's bounding rect.
 */
export const VoiceTypingOverlay: React.FC<IVoiceTypingOverlayProps> = ({ text, tileElement }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!tileElement) return;
    const rect = tileElement.getBoundingClientRect();
    setStyle({
      position: "fixed",
      bottom: window.innerHeight - rect.bottom + 4,
      left: rect.left + 8,
      width: rect.width - 16,
    });
  }, [tileElement, text]);

  if (!text || !tileElement) return null;

  return ReactDOM.createPortal(
    <div ref={overlayRef} className="voice-typing-interim-overlay" style={style} aria-live="polite">
      {text}
    </div>,
    document.body
  );
};
