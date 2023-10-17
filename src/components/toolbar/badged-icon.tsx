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
 */
export function BadgedIcon({ Icon, Badge }: IProps) {
  return (
    <div className="badged-icon">
      <Icon/>
      <Badge className="icon-badge"/>
    </div>
  );
}
