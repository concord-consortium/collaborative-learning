import React from "react";
import classNames from "classnames";
import { Tooltip } from "react-tippy";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";

interface IProps {
  iconName: string;
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  tooltip: string;
  enabled: boolean;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const kTooltipYDistance = 2;

export const TextToolbarButton: React.FC<IProps> = ({
              iconName, Icon, tooltip, enabled, isSelected, onClick
            }: IProps) => {
  const tooltipOptions = useTooltipOptions({ distance: kTooltipYDistance });

  return (
    <Tooltip title={tooltip} {...tooltipOptions}>
      <div className={classNames("button-with-tool-tip", isSelected ? "on" : "off", { enabled })} key={iconName}>
        <Icon className={classNames("button-icon", isSelected ? "on" : "off", { enabled })} onClick={onClick} />
      </div>
    </Tooltip>
  );
};
