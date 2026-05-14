import React, { forwardRef } from "react";

interface IEditableTitleButtonProps {
  className?: string;
  title: string;
  readOnly?: boolean;
  onActivate: () => void;
}

/**
 * The focusable display-mode element shared by editable tile titles. Provides
 * tabIndex=0 + role="button" (omitted when read-only), an aria-label that
 * hints at editability, and Enter/Space activation. Click handling stays on
 * the caller's outer wrapper — this component is purely the keyboard/aria
 * shell so the focus trap's `pickSlotEntryTarget` can land on the title slot.
 *
 * Forwards a ref to the underlying `<div>` so parents can imperatively focus
 * it (e.g. restoring focus after the edit-mode <input> unmounts).
 */
export const EditableTitleButton = forwardRef<HTMLDivElement, IEditableTitleButtonProps>(
  function EditableTitleButton({ className, title, readOnly, onActivate }, ref) {
    return (
      <div
        ref={ref}
        className={className}
        tabIndex={0}
        role={readOnly ? undefined : "button"}
        aria-label={readOnly ? title : `${title}, editable title`}
        onKeyDown={readOnly ? undefined : (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate();
          }
        }}
      >
        {title}
      </div>
    );
  }
);
