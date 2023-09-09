import { useMemo, useRef } from "react";
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
  const cachedOptions = useRef(options);
  const optionsJson = JSON.stringify(options);
  const cachedJson = useRef(optionsJson);
  if (optionsJson !== cachedJson.current) {
    cachedOptions.current = options;
    cachedJson.current = optionsJson;
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ ...kDefaultTooltipOptions, ...cachedOptions.current }), [cachedOptions.current]);
};
