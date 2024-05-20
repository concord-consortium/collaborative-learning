import React, { PropsWithChildren } from "react";
import classNames from "classnames";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import { Tooltip } from "react-tippy";

/**
 * Create the complete tooltip from the given button information.
 * Button titles can have placeholders like {1}, {2} which are replaced by button arguments.
 * If there is a button keyboard shortcut, it is shown after the title.
 */
function formatTooltip(title: string, keyHint?: string) {
  return title + (keyHint ? ` (${keyHint})` : '');
}

export interface TileToolbarButtonProps {
  name: string;       // a unique internal name used in configuration to identify the button
  title: string;      // user-visible name, used in the tooltip
  keyHint?: string,   // If set, displayed to the user as the hotkey equivalent
  onClick: (e: React.MouseEvent) => void; // Action when clicked
  onTouchHold?: (e: React.MouseEvent) => void; // Action when long-pressed
  selected?: boolean; // puts button in 'active' state if defined and true
  disabled?: boolean; // makes button grey and unclickable if defined and true
}

/**
 * A generic, simple button that can go on a tile toolbar.
 */
export const TileToolbarButton =
  function({name, title, keyHint, onClick, selected, disabled, children}: PropsWithChildren<TileToolbarButtonProps>) {

    const tipOptions = useTooltipOptions();

    const tooltip = formatTooltip(title, keyHint);
    return (
      <Tooltip title={tooltip} {...tipOptions} >
        <button
          className={classNames('toolbar-button', name, { selected, disabled })}
          // TODO: confer with Scott about aria-disabled vs. disabled
          disabled={disabled}
          onClick={onClick}
          onMouseDown={(e) => { e.preventDefault(); }}
        >
          {children}
        </button>
      </Tooltip>
    );
  };
