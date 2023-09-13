import { useMemo } from "react";
import { TooltipProps } from "react-tippy";

import "react-tippy/dist/tippy.css";

const kDefaultTooltipOptions: TooltipProps = {
  position: "bottom",
  distance: 0,
  size: "small",
  duration: 0,
  hideDuration: 0,
  animation: "fade",
  animateFill: false
};

export const useTooltipOptions = (options?: TooltipProps) => {
  const optionsJson = JSON.stringify(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tooltipOptions = useMemo(() => ({ ...kDefaultTooltipOptions, ...options }), [optionsJson]);
  return tooltipOptions;
};
