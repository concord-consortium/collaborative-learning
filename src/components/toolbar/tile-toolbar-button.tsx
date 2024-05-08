import React, { PropsWithChildren } from "react";
import classNames from "classnames";
import { Tooltip } from "react-tippy";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";

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
  selected?: boolean; // puts button in 'active' state if defined and true
  disabled?: boolean; // makes button grey and unclickable if defined and true
  extraContent?: JSX.Element; // Additional element added after the button.
}

/**
 * A generic, simple button that can go on a tile toolbar.
 */
export const TileToolbarButton =
  function({name, title, keyHint, onClick, selected, disabled, extraContent, children}:
    PropsWithChildren<TileToolbarButtonProps>) {

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
        {extraContent}
      </Tooltip>
    );
  };
