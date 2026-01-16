import React, { PropsWithChildren } from "react";
import { useTouchHold } from "../../hooks/use-touch-hold";
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
  onTouchHold?: () => void; // Action when long-pressed
  selected?: boolean; // puts button in 'active' state if defined and true
  disabled?: boolean; // makes button grey and unclickable if defined and true
  extraContent?: JSX.Element; // Additional element added after the button.
  colorClass?: string; // color to use for the button icon
  dataTestId?: string; // data-testid attribute for testing
}

/**
 * A generic, simple button that can go on a tile toolbar.
 */
export const TileToolbarButton = function ({
  name,
  title,
  keyHint,
  onClick,
  onTouchHold,
  selected,
  disabled,
  children,
  extraContent,
  colorClass,
  dataTestId
}: PropsWithChildren<TileToolbarButtonProps>) {
  const tipOptions = useTooltipOptions();
  const tooltip = formatTooltip(title, keyHint);

  const { onTouchStart, onTouchEnd, onMouseDown, onMouseUp, onClick: handleOnClick } = useTouchHold(
    () => onTouchHold?.(),
    onClick
  );

  return (
    <Tooltip title={tooltip} {...tipOptions}>
      <button
        className={classNames("toolbar-button", name, colorClass, { selected, disabled })}
        // TODO: confer with Scott about aria-disabled vs. disabled
        disabled={disabled}
        aria-label={tooltip}
        aria-pressed={selected}
        onClick={handleOnClick}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid={dataTestId}
      >
        {children}
      </button>
      {extraContent}
    </Tooltip>
  );
};
