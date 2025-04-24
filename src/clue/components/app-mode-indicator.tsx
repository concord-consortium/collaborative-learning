import React from 'react';
import { Tooltip } from 'react-tippy';

import { AppMode } from '../../models/stores/store-types';
import { useTooltipOptions } from '../../hooks/use-tooltip-options';

import WarningIcon from '../../assets/icons/warning.svg';

import './app-mode-indicator.scss';

interface AppModeIndicatorProps {
  appMode: AppMode;
}

/**
 * An indicator for the top toolbar that displays a warning when you are in preview/dev mode.
 *
 * @param appMode the current app mode
 */
const AppModeIndicator: React.FC<AppModeIndicatorProps> = ({ appMode }) => {

  const tipOptions = useTooltipOptions();

  const kPreviewTooltipHtml =
  <div>
    <p>
      <strong>You are in preview mode.</strong><br/>
      You can explore and try things out, but any changes will not be permanently saved.
    </p>
    <p>To save your work or assign this activity, please sign in or create an account at <a href="https://learn.concord.org">learn.concord.org</a>.</p>
  </div>;

  if (appMode !== "dev") return null;

  return (
    <Tooltip {...tipOptions} interactive={true} html={kPreviewTooltipHtml}>
      <div className="mode">
        <WarningIcon />
        Preview Mode
      </div>
    </Tooltip>
  );
};

export default AppModeIndicator;
