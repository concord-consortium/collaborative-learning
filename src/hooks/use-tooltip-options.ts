import { useMemo } from "react";
import { TooltipProps } from "react-tippy";

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
  return useMemo(() => ({ ...kDefaultTooltipOptions, ...options }), [options]);
};
