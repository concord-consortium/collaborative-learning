import { useCallback, useRef } from "react";

export const useTouchHold = (onTouchHold: () => void, onClick: (e:React.MouseEvent) => void, holdTime = 500) => {
  const holdTimer = useRef<number>();
  const didTouchHold = useRef(false);

  const didTouchHoldCallback = useCallback(() => didTouchHold.current, []);

  const handleDown = useCallback(() => {
    if (!holdTimer.current) {
      holdTimer.current = window.setTimeout(() => {
        onTouchHold();
        didTouchHold.current = true;
      }, holdTime);
    }
  }, [holdTime, onTouchHold]);

  const handleUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = undefined;
    }
    if (didTouchHold.current) {
      // doesn't prevent the click in React 16 but should in React 17
      // https://github.com/facebook/react/issues/9809
      e.preventDefault();
      // didTouchHold.current = false;  // should be sufficient in React 17
      // in React 16 we need to swallow the click ourselves
      window.setTimeout(() => didTouchHold.current = false);
    }
  }, []);

  // shouldn't be necessary with React 17
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (didTouchHold.current) {
      didTouchHold.current = false;
    }
    else {
      onClick(e);
    }
  }, [onClick]);

  return { didTouchHold: didTouchHoldCallback, onTouchStart: handleDown, onTouchEnd: handleUp,
          onMouseDown: handleDown, onMouseUp: handleUp, onClick: handleClick };
};
