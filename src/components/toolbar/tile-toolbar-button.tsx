import classNames from "classnames";
import React from "react";

export interface TileToolbarButtonProps {
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  onClick: (e: React.MouseEvent) => void;
  selected?: boolean; // if undefined, considered to be false
  enabled?: boolean;  // if undefined, considered to be true!
}

export const TileToolbarButton =
  function({Icon, onClick, enabled, selected }: TileToolbarButtonProps) {
    /**
     * A generic, simple button that can go on a tile toolbar.
     */

    return (
        <button
          className={classNames({selected, enabled})}
          disabled={enabled===false}
          onClick={onClick}
          onMouseDown={(e)=>{ e.preventDefault(); }}
        >
          <Icon />
        </button>);
  };
