import React from "react";
import classNames from "classnames";

interface IPaletteControlProps {
  // The accessible name, when the visible text alone doesn't say enough
  label?: string;
  text: string;
  disabled: boolean;
  onActivate: () => void;
  className?: string;
  // Hover text
  title?: string;
  // For a disclosure: whether what it shows is showing, and that element's id
  expanded?: boolean;
  controls?: string;
}

// A control in the connect palette, including its help column. `div role="button"`, not a real
// button, for the reason given at PanPalette's arrows (dataflow-zoom-pan-buttons.tsx).
export function PaletteControl({
  label, text, disabled, onActivate, className, title, expanded, controls
}: IPaletteControlProps) {
  function activate(e: React.SyntheticEvent) {
    e.stopPropagation();
    if ("key" in e) (e as React.KeyboardEvent).preventDefault();
    if (!disabled) onActivate();
  }
  // With a title the name is given outright, since some name computations put the title ahead of
  // the text.
  return (
    <div role="button" tabIndex={0} aria-label={label ?? (title ? text : undefined)}
        aria-disabled={disabled || undefined} aria-expanded={expanded} aria-controls={controls}
        title={title}
        className={classNames("connect-control", className, { disabled })}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") activate(e);
        }}>
      {text}
    </div>
  );
}
