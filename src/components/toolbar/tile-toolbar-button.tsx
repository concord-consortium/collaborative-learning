import classNames from "classnames";
import React, { PropsWithChildren } from "react";

export interface TileToolbarButtonProps {
  onClick: (e: React.MouseEvent) => void;
  selected?: boolean; // puts button in 'active' state if defined and true
  disabled?: boolean; // makes button grey and unclickable if defined and true
}

/**
 * A generic, simple button that can go on a tile toolbar.
 */
export const TileToolbarButton =
  function({onClick, selected, disabled, children}: PropsWithChildren<TileToolbarButtonProps>) {

    return (
        <button
          className={classNames({selected, disabled})}
          // TODO: confer with Scott about aria-disabled vs. disabled
          disabled={disabled}
          onClick={onClick}
          onMouseDown={(e)=>{ e.preventDefault(); }}
        >
          {children}
        </button>);
  };
