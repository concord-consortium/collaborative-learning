import classNames from "classnames";
import React, { PropsWithChildren } from "react";

export interface TileToolbarButtonProps {
  onClick: (e: React.MouseEvent) => void;
  selected?: boolean; // if undefined, considered to be false
  enabled?: boolean;  // if undefined, considered to be true!
}

export const TileToolbarButton =
  function({onClick, enabled, selected, children}: PropsWithChildren<TileToolbarButtonProps>) {
    /**
     * A generic, simple button that can go on a tile toolbar.
     */

    return (
        <button
          className={classNames({selected, enabled})}
          // TODO: confer with Scott about aria-disabled vs. disabled
          disabled={enabled===false}
          onClick={onClick}
          onMouseDown={(e)=>{ e.preventDefault(); }}
        >
          {children}
        </button>);
  };
