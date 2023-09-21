import React from "react";
import { Tooltip } from "react-tippy";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";

interface TileToolbarButtonProps {
  title: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  onClick: (e: React.MouseEvent) => void;
}

export const TileToolbarButton =
  function({title, Icon, onClick }: TileToolbarButtonProps) {

    const tipOptions = useTooltipOptions();

    return (
      <Tooltip title={title} {...tipOptions} >
        <button onClick={onClick}>
          <Icon />
        </button>
      </Tooltip>
    );
  };
