import React, { useCallback, useRef, useEffect, useState } from "react";
import { humidAnimationPhases } from "../demo-output-control-assets";

interface IProps {
  nodeValue: number;
}

// TODO: The old animation used a global map to keep track of the running animations
// The comment on this code indicated that when the left side of CLUE was open that
// multiple animations of the same node would start up and keep running.
// With this upgraded Rete, we should check if that is still a problem.

export const HumidifierAnimation: React.FC<IProps> = ({nodeValue}) => {
  const priorValue = useRef<number | undefined>();
  const [imageSrc, setImageSrc] = useState(humidAnimationPhases.stayOff.frames[0]);
  const intervalRef = useRef<NodeJS.Timeout | undefined>();
  const loopIndexRef = useRef<number>(0);

  function removeAnimation() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }

  function registerAnimation(_interval: any) {
    intervalRef.current = _interval;
  }

  // Remove the animation when the component is disposed
  useEffect(() => {
    return removeAnimation;
  }, []);

  const advanceFrame = useCallback((frames: string[]) => {
    loopIndexRef.current = (loopIndexRef.current + 1) % frames.length;
    const nextFrame = frames[loopIndexRef.current];
    setImageSrc(nextFrame);
  }, [setImageSrc]);

  const startLooping = useCallback(() => {
    if (!intervalRef.current){
      const interval = setInterval(() => {
        advanceFrame(humidAnimationPhases.stayOn.frames);
      }, 100);
      registerAnimation(interval);
    }
  }, [advanceFrame]);

  const stopLooping = useCallback(() => {
    removeAnimation();
  }, []);

  useEffect(() => {
    const justLoaded = priorValue.current === undefined;
    const shouldRampUp = priorValue.current === 0 && nodeValue === 1;
    const shouldRampDown = priorValue.current === 1 && nodeValue === 0;
    const shouldJustLoop = justLoaded && nodeValue === 1;
    const shouldJustRest = justLoaded && nodeValue === 0;

    if (shouldRampUp) {
      setImageSrc(humidAnimationPhases.rampUp.frames[0]);
      humidAnimationPhases.rampUp.frames.forEach((frame, index) => {
        // TODO: we should have a way to cancel this we shouldn't be just adding
        // timeouts for all of the frames, it'd be better to at least just add
        // one at a time unless it is canceled.
        setTimeout(() => {
          setImageSrc(frame);
        }, index * 100);
      });
    }

    if (shouldRampDown) {
      setImageSrc(humidAnimationPhases.rampDown.frames[0]);
      humidAnimationPhases.rampDown.frames.forEach((frame, index) => {
        // TODO: we should have a way to cancel this we shouldn't be just adding
        // timeouts for all of the frames, it'd be better to at least just add
        // one at a time unless it is canceled.
        setTimeout(() => {
          setImageSrc(frame);
        }, index * 100);
      });
    }

    if (shouldJustLoop) setImageSrc(humidAnimationPhases.stayOn.frames[0]);
    if (shouldJustRest) setImageSrc(humidAnimationPhases.stayOff.frames[0]);

    if (shouldJustLoop || shouldRampUp){
      startLooping();
    } else {
      stopLooping();
    }

    priorValue.current = nodeValue;
  },[nodeValue, setImageSrc, startLooping, stopLooping]);

  return (
    <img className={`mist`} src={imageSrc} />
  );
};
