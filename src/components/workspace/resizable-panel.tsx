import React from "react";
import classNames from "classnames";

import "./resizable-panel.scss";

interface IProps {
  collapsed: boolean;
  headingId?: string;
  headingLabel?: string;
}

// Originally this monitored the collapse animation and stopped rendering
// the children when the animation was finished. And then started rendering
// the children again when collapsed was false and then expanded.
//
// This added a lot of complexity and resulted in slower animations.
// The downside is that now developers can't disable all of the extra
// documents shown on the left sided just by collapsing it.
// There is now a hotkey cmd-shit-f which makes the right side take
// the full width and does not render the left side at all.
export const ResizablePanel: React.FC<IProps> = ({
  collapsed,
  headingId,
  headingLabel,
  children
}) => {
  return (
    <section
      className={classNames("resizable-panel", {collapsed})}
      aria-labelledby={headingId}
    >
      {headingLabel && (
        <h2 id={headingId} className={classNames("section-heading", headingId)}>
          {headingLabel}
        </h2>
      )}
      {children}
    </section>
  );
};
