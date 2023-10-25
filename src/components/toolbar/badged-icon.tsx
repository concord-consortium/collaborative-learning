import React, { SVGProps } from "react";

import "./badged-icon.scss";

interface IProps {
  Icon: React.FC<SVGProps<SVGSVGElement>>;
  Badge: React.FC<SVGProps<SVGSVGElement>>;
}

/**
 * Attaches a small "badge" icon to a main (usually larger) icon.
 * The badge is displayed at the upper right of the main icon.
 * For use inside a container element such as a button.
 *
 * Note: with the current approach, you either need to (a) give the
 * Badge a transparent background, so that the correct background color
 * for hovered or selected buttons can show through, but possibly also
 * making the badge hard to read if it is overlaying visible parts of
 * the Icon, or (b) give the Badge a solid background, making it easy
 * to see but not responding correctly to hover or select.
 * In the future, this could be improved by allowing a 3rd "clip-path" SVG
 * to be provided as well. This clip-path could hide the part of the
 * Icon that is under the Badge without requiring opacity.
 * See https://www.pivotaltracker.com/n/projects/2441242/stories/186082779 .
 */
export function BadgedIcon({ Icon, Badge }: IProps) {
  return (
    <div className="badged-icon">
      <Icon/>
      <Badge className="icon-badge"/>
    </div>
  );
}
